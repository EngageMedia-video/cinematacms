from pathlib import Path
from django.conf import settings

def get_whisper_cpp_paths():
  """
  Dynamically determine whisper.cpp paths relative to cinematacms directory.
  """
  
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
      whisper_cpp_dir / "build" / "bin" / "whisper-cli", # New main loc
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
  # NOTE: to change models, make sure that the replacement model is installed within the /whisper.cpp repo
  # before updating the .bin file associated with this variable
  whisper_cpp_model = str(whisper_cpp_dir / "models" / "ggml-base.bin")
  
  return (str(whisper_cpp_dir), whisper_cpp_command, whisper_cpp_model)