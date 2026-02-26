from django.contrib.auth.password_validation import (
    CommonPasswordValidator,
    MinimumLengthValidator,
    NumericPasswordValidator,
    UserAttributeSimilarityValidator,
)
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class CustomUserAttributeSimilarityValidator(UserAttributeSimilarityValidator):
    def validate(self, password, user=None):
        try:
            super().validate(password, user)
        except ValidationError:
            raise ValidationError(
                _("Cannot be similar to your personal information"),
                code="password_too_similar",
            )

    def get_help_text(self):
        return _("Cannot be similar to your personal information")


class CustomMinimumLengthValidator(MinimumLengthValidator):
    def validate(self, password, user=None):
        try:
            super().validate(password, user)
        except ValidationError:
            raise ValidationError(
                _("At least 14 characters long"),
                code="password_too_short",
            )

    def get_help_text(self):
        return _("At least 14 characters long")


class CustomCommonPasswordValidator(CommonPasswordValidator):
    def validate(self, password, user=None):
        try:
            super().validate(password, user)
        except ValidationError:
            raise ValidationError(
                _("Cannot be a commonly used password"),
                code="password_too_common",
            )

    def get_help_text(self):
        return _("Cannot be a commonly used password")


class CustomNumericPasswordValidator(NumericPasswordValidator):
    def validate(self, password, user=None):
        try:
            super().validate(password, user)
        except ValidationError:
            raise ValidationError(
                _("Must include characters other than just numbers"),
                code="password_entirely_numeric",
            )

    def get_help_text(self):
        return _("Must include characters other than just numbers")
