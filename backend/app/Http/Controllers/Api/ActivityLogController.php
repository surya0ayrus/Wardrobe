<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ActivityLogResource;
use App\Models\ActivityLog;
use App\Models\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ActivityLogController extends Controller
{
    /**
     * Filters: user_id, action, module (+ record_id for one record's history), date_from, date_to.
     * Uses "simple" pagination (next / previous only): no count(*) on a table that keeps growing.
     */
    public function index(Request $request)
    {
        $this->authorize('viewAny', ActivityLog::class);

        $request->validate([
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
        ]);

        $logs = ActivityLog::query()
            ->with('user:id,name')
            ->when($request->integer('user_id') ?: null, fn ($q, $id) => $q->where('user_id', $id))
            ->when($request->query('action'), fn ($q, $action) => $q->where('action', $action))
            ->when($request->query('module'), fn ($q, $module) => $q->where('loggable_type', $module))
            ->when($request->integer('record_id') ?: null, fn ($q, $id) => $q->where('loggable_id', $id))
            ->when($request->query('date_from'), fn ($q, $date) => $q->where('created_at', '>=', $date))
            ->when($request->query('date_to'), fn ($q, $date) => $q->where('created_at', '<', Carbon::parse($date)->addDay()))
            ->orderByDesc('id')
            ->simplePaginate(min(max($request->integer('per_page', 25), 1), 100))
            ->withQueryString();

        return ActivityLogResource::collection($logs);
    }

    /** Full detail of one log entry, with who did it and which record it is about. */
    public function show(ActivityLog $activityLog): ActivityLogResource
    {
        $this->authorize('view', $activityLog);

        $activityLog->load('user:id,name,username,email');

        return (new ActivityLogResource($activityLog))->additional(['record' => $this->recordSummary($activityLog)]);
    }

    /** Name of the logged record (also when it was deleted later), or null. */
    private function recordSummary(ActivityLog $log): ?array
    {
        $class = $log->loggable_type ? Relation::getMorphedModel($log->loggable_type) : null;
        if (! $class || ! $log->loggable_id) {
            return null;
        }

        $softDeletes = in_array(SoftDeletes::class, class_uses_recursive($class), true);
        $query = $class::query();
        if ($softDeletes) {
            $query->withTrashed();
        }
        $record = $query->find($log->loggable_id);

        return [
            'exists' => (bool) $record,
            'deleted' => $softDeletes && $record?->trashed(),
            // To link to the record's page; only records with a public id have one (users are linked by id).
            'uuid' => $record && in_array(HasPublicId::class, class_uses_recursive($record), true) ? $record->uuid : null,
            'label' => $record?->name ?? $record?->username ?? $record?->short_name,
        ];
    }
}
