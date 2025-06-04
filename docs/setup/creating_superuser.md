Before creating or modifying superusers:
1. Ensure the application is installed and accessible
2. Run all commands as a user with access to the CinemataCMS environment
3. Activate the virtual environment to ensure proper dependency handling

# Add a new superuser:
The process needs to activate virtual environment.

```zsh
cd /home/cinemata/cinematacms
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 manage.py createsuperuser
```
Follow on screen prompts to add user.

Restart service- 
```zsh
sudo systemctl restart mediacms
```
## Top promote existing user to superuser:

```zsh
cd /home/cinemata/cinematacms
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 manage.py shell
```

Run this-
```zsh
from django.contrib.auth import get_user_model 

User = get_user_model()  # Get the correct user model
user = User.objects.get(username="existing_username")

print(user.is_superuser, user.is_staff)  # Should print: True True

user.is_superuser = True
user.is_staff = True
user.save()

print("User updated successfully!")
```
Run- exit() to quite from shell.


Restart service- 
```zsh
sudo systemctl restart mediacms
```
