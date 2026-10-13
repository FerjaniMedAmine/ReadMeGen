"""Keep temporary files alive until cancelled filesystem work actually stops."""

import asyncio
from collections.abc import Callable
from contextlib import suppress


async def run_blocking[T](function: Callable[..., T], *args) -> T:
    task = asyncio.create_task(asyncio.to_thread(function, *args))
    try:
        return await asyncio.shield(task)
    except asyncio.CancelledError:
        # Cancelling to_thread does not stop its OS thread. Join before cleanup.
        with suppress(Exception):
            await task
        raise
