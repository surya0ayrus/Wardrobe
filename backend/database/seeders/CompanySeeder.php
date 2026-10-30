<?php

namespace Database\Seeders;

use App\Models\Company;
use Illuminate\Database\Seeder;

/** The first company (config/base.php); more are added on the Companies page. */
class CompanySeeder extends Seeder
{
    public function run(): void
    {
        $config = config('base.default_company');

        if (Company::doesntExist()) {
            Company::create(['short_name' => $config['short_name'], 'name' => $config['name']]);
        }
    }
}
