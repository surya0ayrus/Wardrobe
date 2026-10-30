<?php

namespace App\Http\Resources;

/**
 * is_active, created/updated by + at, deleted_at: shared by every master resource.
 * creator / updater names appear only when loaded (show page), to keep lists light.
 */
trait AuditFields
{
    protected function auditFields(): array
    {
        return [
            'is_active' => $this->is_active,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'deleted_at' => $this->deleted_at,
            'created_by' => $this->whenLoaded('creator', fn () => $this->creator?->only('id', 'name')),
            'updated_by' => $this->whenLoaded('updater', fn () => $this->updater?->only('id', 'name')),
        ];
    }
}
