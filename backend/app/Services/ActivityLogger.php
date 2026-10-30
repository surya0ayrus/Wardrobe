<?php

namespace App\Services;

use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

/**
 * Writes rows to activity_logs.
 */
class ActivityLogger
{
    private const HIDDEN = ['password', 'password_confirmation', 'remember_token', 'current_password', 'token'];

    private const MAX_STRING = 2000;

    private static bool $enabled = true;

    public static function log(string $action, ?Model $model = null, ?array $old = null, ?array $new = null): void
    {
        if (! self::$enabled) {
            return;
        }

        $request = app()->runningInConsole() ? null : request();

        ActivityLog::create([
            'user_id' => Auth::id(),
            'action' => $action,
            'loggable_type' => $model?->getMorphClass(),
            'loggable_id' => $model?->getKey(),
            'old_values' => self::clean($old),
            'new_values' => self::clean($new),
            'ip_address' => $request?->ip(),
            'user_agent' => $request ? substr((string) $request->userAgent(), 0, 500) : null,
            'url' => $request?->fullUrl(),
            'method' => $request?->method(),
        ]);
    }

    /**
     * Run code without writing a log row per record, e.g. during a big import
     * (the import writes one summary row instead).
     */
    public static function withoutLogging(callable $callback): mixed
    {
        $previous = self::$enabled;
        self::$enabled = false;

        try {
            return $callback();
        } finally {
            self::$enabled = $previous;
        }
    }

    /** Masks secrets and shortens very long strings. */
    private static function clean(?array $values): ?array
    {
        if ($values === null) {
            return null;
        }

        foreach ($values as $key => $value) {
            if (in_array($key, self::HIDDEN, true)) {
                $values[$key] = '***';
            } elseif (is_array($value)) {
                $values[$key] = self::clean($value);
            } elseif (is_string($value) && mb_strlen($value) > self::MAX_STRING) {
                $values[$key] = mb_substr($value, 0, self::MAX_STRING).'…';
            }
        }

        return $values;
    }
}
