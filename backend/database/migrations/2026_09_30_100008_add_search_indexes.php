<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Trigram indexes make "contains" searches (ILIKE '%text%') fast on big lists.
     * One index per searchable column, so a plain OR search uses them.
     */
    private array $columns = [
        'users' => ['name', 'username', 'email'],
        'companies' => ['name', 'short_name'],
    ];

    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');

        foreach ($this->columns as $table => $columns) {
            foreach ($columns as $column) {
                DB::statement("CREATE INDEX {$table}_{$column}_trgm ON {$table} USING gin ({$column} gin_trgm_ops)");
            }
        }
    }

    public function down(): void
    {
        foreach ($this->columns as $table => $columns) {
            foreach ($columns as $column) {
                DB::statement("DROP INDEX IF EXISTS {$table}_{$column}_trgm");
            }
        }
    }
};
