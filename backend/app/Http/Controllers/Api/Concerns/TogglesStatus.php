<?php

namespace App\Http\Controllers\Api\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Adds PATCH /{resource}/{id}/status { is_active: bool }, the Active switch in the lists.
 * Needs the update permission. The controller says how to find the record and,
 * when switching it needs more than the column (e.g. user logins), how to apply it.
 */
trait TogglesStatus
{
    public function status(Request $request, string $id): JsonResponse
    {
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        $record = $this->statusRecord($request, $id);
        $this->authorize('update', $record);

        $this->applyStatus($request, $record, $data['is_active']);

        return response()->json(['data' => ['id' => $record->id, 'is_active' => $record->is_active]]);
    }

    /** The record to switch; deleted records are not found. */
    abstract protected function statusRecord(Request $request, string $id): Model;

    protected function applyStatus(Request $request, Model $record, bool $active): void
    {
        $record->update(['is_active' => $active]);
    }
}
