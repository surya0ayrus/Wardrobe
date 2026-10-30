<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Login accounts. current_company_id gets its foreign key with the companies table.
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('username', 50);
            $table->string('email')->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('password');
            $table->boolean('is_active')->default(true)->index();
            $table->boolean('is_first_login')->default(true);
            $table->unsignedBigInteger('current_company_id')->nullable();
            $table->string('timezone', 50)->default('Asia/Kolkata');
            $table->jsonb('settings')->nullable(); // personal preferences (layout, theme)
            $table->timestampTz('last_login_at')->nullable();
            $table->rememberToken();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
            $table->softDeletesTz();
        });

        // Unique only among rows that are not deleted, so a deleted login does not block its name.
        DB::statement('create unique index users_username_unique on users (username) where deleted_at is null');
        DB::statement('create unique index users_email_unique on users (email) where deleted_at is null');

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
