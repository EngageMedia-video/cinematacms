from collections import OrderedDict  # requires Python 2.7 or later

from django.core.paginator import Paginator
from django.utils.functional import cached_property
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class FasterDjangoPaginator(Paginator):
    @cached_property
    def count(self):
        return 50


class FastPaginationWithoutCount(PageNumberPagination):
    # for cases where a SELECT COUNT is expensive and not needed
    # EG on recommended media, where we can't continue this pagination for
    # a large number (makes no sense)
    django_paginator_class = FasterDjangoPaginator

    def get_paginated_response(self, data):
        return Response(
            OrderedDict(
                [
                    ("next", self.get_next_link()),
                    ("previous", self.get_previous_link()),
                    ("results", data),
                ]
            )
        )
