import logging
from pathlib import Path

logger = logging.getLogger(__name__)

VALID_WHISPER_MODELS = ("tiny", "base", "small", "medium", "large", "large-v1", "large-v2", "large-v3")


def get_whisper_cpp_paths(model_name="base"):
    """
    Dynamically determine whisper.cpp paths relative to cinematacms directory.

    Args:
        model_name: Whisper model to use. Valid values: tiny, base, small, medium, large, large-v1, large-v2, large-v3.
                    Falls back to 'base' if invalid or model file not found.

    Returns:
        Tuple of (whisper_cpp_dir, whisper_cpp_command, whisper_cpp_model, resolved_model_name)
    """

    # Validate model name
    if model_name not in VALID_WHISPER_MODELS:
        logger.warning(
            "Invalid WHISPER_MODEL '%s'. Valid options: %s. Falling back to 'base'.",
            model_name,
            ", ".join(VALID_WHISPER_MODELS),
        )
        model_name = "base"

    # Get the absolute path of the current settings file
    current_file_path = Path(__file__).resolve()

    # Navigate to the cinematacms root directory
    # If this is cms/settings.py, go up one level to cinematacms root
    # If this is cms/local_settings.py, go up one level to cinematacms root
    cinematacms_root = current_file_path.parent.parent

    # Get the parent directory that contains both cinematacms and whisper.cpp
    parent_directory = cinematacms_root.parent

    # Define whisper.cpp directory path
    whisper_cpp_dir = parent_directory / "whisper.cpp"

    # Define paths for whisper.cpp components
    whisper_cpp_main_paths = [
        whisper_cpp_dir / "build" / "bin" / "whisper-cli",  # New main loc
    ]

    # Find the actual whisper.cpp main executable
    whisper_cpp_command = None
    for path in whisper_cpp_main_paths:
        if path.exists() and path.is_file():
            whisper_cpp_command = str(path)
            break

    # If no main executable found, use the first standard path as fallback
    if whisper_cpp_command is None:
        whisper_cpp_command = str(whisper_cpp_main_paths[0])

    # Define model path
    whisper_cpp_model_path = whisper_cpp_dir / "models" / f"ggml-{model_name}.bin"

    # If the requested model file doesn't exist and it's not the default, fall back to base
    if not whisper_cpp_model_path.is_file() and model_name != "base":
        logger.warning(
            "Whisper model file not found at '%s'. Falling back to 'base'.",
            whisper_cpp_model_path,
        )
        model_name = "base"
        whisper_cpp_model_path = whisper_cpp_dir / "models" / "ggml-base.bin"

    if not whisper_cpp_model_path.is_file():
        logger.error(
            "Whisper base model file not found at '%s'. Transcription will fail.",
            whisper_cpp_model_path,
        )

    return (str(whisper_cpp_dir), whisper_cpp_command, str(whisper_cpp_model_path), model_name)
