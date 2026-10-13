"""Errors safe to display in either interface."""


class ReadMeGenError(Exception):
    """An actionable application error; messages must never contain credentials."""


class ConfigurationError(ReadMeGenError):
    """Missing or invalid model configuration."""


class ImportError(ReadMeGenError):
    """An invalid, unsupported, or oversized project source."""


class GenerationError(ReadMeGenError):
    """A model or agent failed to produce a complete README."""
