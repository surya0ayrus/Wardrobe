<?php

namespace App\Models\Concerns;

use App\Services\ActivityLogger;

/**
 * Writes an activity_logs row on create / update / delete / restore.
 * Updates store only the fields that changed (old -> new). Fields a model lists in
 * $hiddenFromLog (e.g. credentials) are written as "[hidden]", never their value.
 */
trait LogsActivity
{
    public static function bootLogsActivity(): void
    {
        static::created(function ($model) {
            ActivityLogger::log('created', $model, null, $model->hideForLog($model->attributesForLog()));
        });

        static::updated(function ($model) {
            $ignored = ['updated_at', 'updated_by', 'created_at', 'deleted_at', 'remember_token', 'last_login_at'];
            $new = array_diff_key($model->getChanges(), array_flip($ignored));

            if ($new) {
                $old = array_intersect_key($model->getPrevious(), $new);
                ActivityLogger::log('updated', $model, $model->hideForLog($old), $model->hideForLog($new));
            }
        });

        static::deleted(function ($model) {
            $forced = method_exists($model, 'isForceDeleting') && $model->isForceDeleting();
            ActivityLogger::log($forced ? 'force_deleted' : 'deleted', $model, $model->hideForLog($model->attributesForLog()));
        });

        if (method_exists(static::class, 'restored')) {
            static::restored(fn ($model) => ActivityLogger::log('restored', $model));
        }
    }

    /** Replaces the values of the model's $hiddenFromLog fields with "[hidden]". */
    public function hideForLog(?array $values): ?array
    {
        if ($values === null || ! property_exists($this, 'hiddenFromLog')) {
            return $values;
        }
        foreach ($this->hiddenFromLog as $field) {
            if (array_key_exists($field, $values)) {
                $values[$field] = '[hidden]';
            }
        }

        return $values;
    }

    protected function attributesForLog(): array
    {
        return array_diff_key($this->getAttributes(), array_flip(['created_at', 'updated_at', 'deleted_at']));
    }
}
