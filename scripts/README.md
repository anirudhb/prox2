# scripts

Run these commands (in this folder):
```
$ yarn tsc -p tsconfig.json --noEmit false --module commonjs
```

Then in the root folder:
```
$ yarn node scripts/migrate_airtable_to_postgres.js
```
