<?php

namespace App\Support;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Shared list handling for every index endpoint:
 *   ?search=abc          contains-search on the given columns
 *   ?status=active       active | inactive
 *   ?sort=-name          column, "-" for descending; lists default to -id (newest first).
 *                        Columns in $natural sort their digits as numbers (1, 2, 10, G2, G10).
 *   ?page=2&per_page=25  pagination (max 100)
 */
class ListQuery
{
    public static function paginate(
        Builder $query,
        Request $request,
        array $searchable = [],
        array $sortable = ['id'],
        string $defaultSort = '-id',
        array $natural = [],
    ): LengthAwarePaginator {
        $table = $query->getModel()->getTable();

        if ($search = trim((string) $request->query('search'))) {
            $term = '%'.addcslashes($search, '%_\\').'%';
            $query->where(function ($q) use ($searchable, $term) {
                foreach ($searchable as $column) {
                    $q->orWhere($column, 'ilike', $term);
                }
            });
        }

        $status = $request->query('status');
        if (in_array($status, ['active', 'inactive'], true)) {
            $query->where("$table.is_active", $status === 'active');
        }

        $sort = (string) $request->query('sort', $defaultSort);
        $column = ltrim($sort, '-');
        if (! in_array($column, $sortable, true)) {
            [$sort, $column] = [$defaultSort, ltrim($defaultSort, '-')];
        }
        $direction = str_starts_with($sort, '-') ? 'desc' : 'asc';
        in_array($column, $natural, true)
            ? $query->orderByRaw("$table.$column collate natural_sort $direction")
            : $query->orderBy("$table.$column", $direction);

        if ($column !== 'id') {
            $query->orderBy("$table.id"); // stable order between pages
        }

        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        return $query->paginate($perPage)->withQueryString();
    }
}
