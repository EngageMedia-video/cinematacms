from django.conf import settings
from django.db import models
from django.db.models.functions import Cast

from files.helpers import mask_ip


class MaskedIPField(models.CharField):
    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if settings.MASK_IPS_FOR_ACTIONS and value:
            return mask_ip(value)
        return value

    def get_db_prep_save(self, value, connection):
        if settings.MASK_IPS_FOR_ACTIONS and hasattr(value, "as_sql"):
            value = self._mask_expression(value)
        return super().get_db_prep_save(value, connection)

    def _mask_expression(self, expression):
        if isinstance(expression, models.Value):
            return models.Value(self.get_prep_value(expression.value), output_field=self)
        if isinstance(expression, models.Case):
            expression = expression.copy()
            expression.cases = [case.copy() for case in expression.cases]
            for case in expression.cases:
                case.result = self._mask_expression(case.result)
            expression.default = self._mask_expression(expression.default)
            return expression
        if isinstance(expression, Cast):
            return Cast(self._mask_expression(expression.get_source_expressions()[0]), output_field=self)
        raise ValueError("remote_ip requires literal values when MASK_IPS_FOR_ACTIONS is enabled")
