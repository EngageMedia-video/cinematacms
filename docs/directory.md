### Definitions

by [Jay Cruz](https://github.com/jmcruz14) (Philippines)

- `actions/` - contains models/views/apps pertaining to user actions that are implemented for the application
- `cms/` - core Django settings and configurations
- `deploy/` - contains relevant deployment scripts that are utilized when attempting to deploy and instantiate Cinemata in a staging or production environment
- `files/` - scripts involved in media services and functionality like the video streaming portion (ex. admin comments on videos)
- `fixtures/` - Contains JSON-represented fixtures which are loaded into the running database during installation.
- `frontend/` - This is the working directory which contains the React-side code of the CMS
- `images/` - images stored for github repo use
- `static/` - This is the copied and compiled code from the `frontend/` folder after `npm build` is executed. It is also information that is used when `python manage.py collectstatic` is run
- `templates/` - Contains the Jinja-formatted HTML templates which are used in compiling and instantiating Cinemata
- `uploader/` - Contains manual configurations and modifications to the uploader
- `users/` - scripts related to the user management aspect of the CMS