<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CompanyResource extends JsonResource
{
    use AuditFields;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid, // used in URLs instead of the id
            'name' => $this->name,
            'short_name' => $this->short_name,
            'gstin' => $this->gstin,
            'pan' => $this->pan,
            'email' => $this->email,
            'phone' => $this->phone,
            'address' => $this->address,
            'city' => $this->city,
            'pincode' => $this->pincode,
            'users_count' => $this->whenCounted('users'),
            ...$this->auditFields(),
        ];
    }
}
