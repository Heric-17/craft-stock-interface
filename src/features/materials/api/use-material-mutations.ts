import { useMutation, useQueryClient } from '@tanstack/react-query';

import { invalidateStockDependents } from '@/shared/api/invalidate-stock-dependents';

import { toMaterial } from '../model/material';
import type { ConsumptionUnit } from '@/shared/quantity';

import type { MaterialUpdate } from '../model/material-form';
import {
  buildLossRequest,
  buildStockEntryRequest,
  type LossDetails,
  type StockAdjustment,
} from '../model/stock-adjustment';
import { toStockLoss, toStockLossResult } from '../model/stock-loss';
import type { Quantity } from '@/shared/quantity';

import { materialKeys } from './material-keys';
import {
  deleteMaterial,
  deleteMaterialImage,
  deleteStockLoss,
  patchConsumptionUnit,
  patchMaterial,
  postDiscontinue,
  postMaterial,
  postMaterialImage,
  postReactivate,
  postStockEntry,
  postStockLoss,
} from './material-requests';
import type { CreateMaterialRequestDto } from './material.dto';

/**
 * Every mutation here invalidates the same three things, through
 * `invalidateStockDependents`: the materials, the composite products and the
 * shortage list. The backend derives cost, suggested price, production
 * capacity and what is missing at read time, so a change to a material is a
 * change to every product whose bill of materials uses it — a package cost, a
 * stock entry, a discontinuation, even a photo. None of them is applied
 * optimistically: the server calculates and the screen waits for it.
 */

/** Registers a material. It starts with no stock; entries come through "Dar entrada". */
export function useCreateMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateMaterialRequestDto) => toMaterial(await postMaterial(body)),
    onSuccess: () => invalidateStockDependents(queryClient),
  });
}

/**
 * Edits a material. A changed consumption unit has its own route and goes
 * first: it is the one the API may refuse (`CONSUMPTION_UNIT_LOCKED`), and
 * refusing it must leave every other field of the form untouched.
 *
 * Invalidates on failure as well: if the unit was changed and the next call
 * failed, the material on screen is already different from the cache.
 */
export function useUpdateMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, update }: { id: string; update: MaterialUpdate }) => {
      if (update.consumptionUnit !== null) {
        await patchConsumptionUnit(id, { consumptionUnit: update.consumptionUnit });
      }

      return toMaterial(await patchMaterial(id, update.patch));
    },
    onSettled: () => invalidateStockDependents(queryClient),
  });
}

/**
 * Changes the stock by hand: an entry, a write-off or a recount. All three are
 * the same endpoint and the same invalidation — a different quantity of a
 * material changes what every product that uses it can be made with, and what
 * is missing for the open sales.
 */
export function useAdjustStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, adjustment }: { id: string; adjustment: StockAdjustment }) =>
      toMaterial(await postStockEntry(id, buildStockEntryRequest(adjustment))),
    onSuccess: () => invalidateStockDependents(queryClient),
  });
}

/**
 * A write-off with its reason: a loss, kept in the history with the cost it had
 * when it was recorded. It cannot be undone — a mistake is corrected with a
 * recount — and so there is no mutation that does. Invalidates what every change of stock does — the
 * materials (and with them the loss list and its dataset, which live under that
 * root), the products that use it and the shortage list.
 *
 * It does so **when it fails too**. The one failure that matters here is
 * `INSUFFICIENT_STOCK`, which means the stock on screen was older than the API's
 * (another tab, a sale assembled meanwhile), and the answer to it is the new
 * balance, not the same stale one.
 */
export function useRecordLoss() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      unit,
      quantity,
      details,
    }: {
      id: string;
      unit: ConsumptionUnit;
      quantity: Quantity;
      details: LossDetails;
    }) => toStockLossResult(await postStockLoss(id, buildLossRequest(quantity, details)), unit),
    onSettled: () => invalidateStockDependents(queryClient),
  });
}

export function useDiscontinueMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => toMaterial(await postDiscontinue(id)),
    onSuccess: () => invalidateStockDependents(queryClient),
  });
}

export function useReactivateMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => toMaterial(await postReactivate(id)),
    onSuccess: () => invalidateStockDependents(queryClient),
  });
}

/**
 * A physical delete, allowed only while nothing refers to the material.
 * `ENTITY_IN_USE` is an answer, not a failure: the screen explains what refers
 * to it and offers to discontinue instead.
 *
 * The deleted material's own queries are dropped first, so nothing tries to
 * fetch a record that no longer exists.
 */
export function useDeleteMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteMaterial(id),
    onSuccess: async (_result, id) => {
      queryClient.removeQueries({ queryKey: materialKeys.detail(id) });
      await invalidateStockDependents(queryClient);
    },
  });
}

/** The second call of "create with a photo", and of changing one later. */
export function useUploadMaterialImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) =>
      toMaterial(await postMaterialImage(id, file)),
    onSuccess: () => invalidateStockDependents(queryClient),
  });
}

export function useRemoveMaterialImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => toMaterial(await deleteMaterialImage(id)),
    onSuccess: () => invalidateStockDependents(queryClient),
  });
}

/**
 * Deletes a loss that was recorded by mistake.
 *
 * It invalidates **only the loss history** — the list and the dataset that the
 * month's total is read from, which live under one key — and not the materials,
 * the products or the shortages that every other change of stock invalidates:
 * deleting a loss leaves the stock exactly where it was, so nothing that reads a
 * stock has changed. The total of the period is read again from the dataset and
 * never subtracted here.
 *
 * It does so when it fails as well. The failure that matters is
 * `STOCK_LOSS_NOT_FOUND`: the loss was already deleted, in another tab or by a
 * double click, and the list is what has to catch up.
 */
export function useDeleteStockLoss() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lossId, unit }: { lossId: string; unit: ConsumptionUnit }) =>
      toStockLoss(await deleteStockLoss(lossId), unit),
    onSettled: () => queryClient.invalidateQueries({ queryKey: materialKeys.losses() }),
  });
}
