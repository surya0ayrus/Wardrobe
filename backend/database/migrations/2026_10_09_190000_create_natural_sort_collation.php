<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * "natural_sort": compares the digits in text as numbers, so codes sort 1, 2, 10, G2, G10
     * instead of 1, 10, 2, G10, G2. Used by ListQuery's $natural columns.
     */
    public function up(): void
    {
        DB::statement("create collation if not exists natural_sort (provider = icu, locale = 'und-u-kn-true')");
    }

    public function down(): void
    {
        DB::statement('drop collation if exists natural_sort');
    }
};
