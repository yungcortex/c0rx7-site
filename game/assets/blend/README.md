# assets/blend/ — character source files

Large binary `.blend` files live here locally but are **not committed** to the
repo (they're 50-200MB each — keep on local disk or push to Cloudflare R2).

Drop your authoring files here as:

```
assets/blend/character/base-hjari.blend
assets/blend/character/base-sivit.blend
assets/blend/character/base-korr.blend
assets/blend/character/base-vellish.blend
```

Then export to glTF runtime format with `tools/blender/export-character.py`
(see `tools/blender/README.md`).

The exported `.glb` and `.meta.json` files DO get committed (under
`assets/models/`) — they're an order of magnitude smaller and are what the
runtime actually loads.
