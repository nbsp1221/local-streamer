# Shared

This directory is reserved for truly shared code only.

If ownership is unclear, the code should stay inside its bounded context instead of being moved here.

`app/shared/ui` is the canonical shadcn-based primitive layer for new frontend work.
Treat shadcn-generated primitive files there as generated source and prefer regeneration or usage-layer fixes over manual patching.
