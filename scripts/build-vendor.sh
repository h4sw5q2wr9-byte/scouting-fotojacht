#!/bin/sh
# Reproducible SDK bundle. No provider credentials are used.
set -eu
vendor_temp_dir=$(mktemp -d)
trap 'rm -rf "$vendor_temp_dir"' EXIT
npm install --prefix "$vendor_temp_dir" @supabase/supabase-js@2.118.0 esbuild@0.25.12 --no-audit --no-fund
"$vendor_temp_dir/node_modules/.bin/esbuild" "$vendor_temp_dir/node_modules/@supabase/supabase-js/dist/index.mjs" --bundle --format=iife --global-name=FotojachtSupabase --minify --target=safari15.4 --outfile=vendor/supabase.js
cp "$vendor_temp_dir/node_modules/@supabase/supabase-js/LICENSE" vendor/SUPABASE-LICENSE.txt
