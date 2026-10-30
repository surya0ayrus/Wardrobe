<?php

namespace App\Models\Concerns;

use Illuminate\Support\Facades\DB;

/**
 * A code made when the record is saved: a prefix and a number counted per prefix
 * (AOA-0001, PPC-0001 …). Never typed, never reused (deleted records keep theirs).
 * When the prefix changes (e.g. the record moves to another list), it gets that prefix's
 * next code. The model says which prefix applies in codePrefix().
 */
trait HasGeneratedCode
{
    abstract public function codePrefix(): string;

    public static function bootHasGeneratedCode(): void
    {
        static::saving(function ($model) {
            $prefix = $model->codePrefix();
            if (! $model->code || ! str_starts_with($model->code, "$prefix-")) {
                $model->code = static::nextCode($prefix);
            }
        });
    }

    /** Next free code for the prefix. A lock per prefix gives two people saving at once different numbers. */
    public static function nextCode(string $prefix): string
    {
        $table = (new static)->getTable();

        return DB::transaction(function () use ($prefix, $table) {
            DB::select('select pg_advisory_xact_lock(hashtext(?))', ["$table:$prefix"]);

            $last = (int) static::withTrashed()
                ->where('code', 'like', "$prefix-%")
                ->max(DB::raw("cast(substring(code from '[0-9]+$') as integer)"));

            return sprintf('%s-%04d', $prefix, $last + 1);
        });
    }
}
