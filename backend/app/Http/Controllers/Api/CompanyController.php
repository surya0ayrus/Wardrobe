<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\TogglesStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\CompanyResource;
use App\Models\Company;
use App\Support\ListQuery;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/**
 * Companies: the reference CRUD module (list, add, view, edit, Active switch, soft delete).
 * Copy it as the starting point for a new module.
 */
class CompanyController extends Controller
{
    use TogglesStatus;

    public function index(Request $request)
    {
        $this->authorize('viewAny', Company::class);

        $query = Company::query()->withCount('users');

        return CompanyResource::collection(ListQuery::paginate(
            $query, $request,
            searchable: ['companies.name', 'companies.short_name', 'companies.email', 'companies.city'],
            sortable: ['id', 'name', 'short_name', 'created_at'],
            defaultSort: '-id', // newest first, like every list
        ));
    }

    public function store(Request $request): CompanyResource
    {
        $this->authorize('create', Company::class);

        $company = Company::create($this->validated($request));

        return $this->resource($company);
    }

    public function show(string $id): CompanyResource
    {
        $company = $this->find($id);
        $this->authorize('view', $company);

        return $this->resource($company);
    }

    public function update(Request $request, string $id): CompanyResource
    {
        $company = $this->find($id);
        $this->authorize('update', $company);

        $company->update($this->validated($request, $company));

        return $this->resource($company);
    }

    public function destroy(string $id): Response
    {
        $company = $this->find($id);
        $this->authorize('delete', $company);
        abort_if($company->users()->exists(), 422, 'This company has users. Remove them from it first.');

        $company->delete();

        return response()->noContent();
    }

    // ── Helpers ──────────────────────────────────────────────────

    private function validated(Request $request, ?Company $company = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'short_name' => ['required', 'string', 'max:20', Rule::unique('companies')->withoutTrashed()->ignore($company?->id)],
            'gstin' => ['nullable', 'string', 'max:20'],
            'pan' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:20'],
            'address' => ['nullable', 'string', 'max:1000'],
            'city' => ['nullable', 'string', 'max:100'],
            'pincode' => ['nullable', 'string', 'max:10'],
        ]);
        $data['short_name'] = mb_strtoupper(trim($data['short_name']));

        return $data;
    }

    protected function statusRecord(Request $request, string $id): Model
    {
        return $this->find($id);
    }

    private function find(string $id): Company
    {
        return Company::where('uuid', $id)->firstOrFail();
    }

    private function resource(Company $company): CompanyResource
    {
        return new CompanyResource($company->load('creator:id,name', 'updater:id,name')->loadCount('users'));
    }
}
