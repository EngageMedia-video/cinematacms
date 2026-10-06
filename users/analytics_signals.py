"""Count completed authentication, including MFA, without instrumenting security forms."""

from allauth.account.signals import user_logged_in, user_logged_out, user_signed_up
from django.dispatch import receiver

from cms.analytics import queue_action, visitor_segment


@receiver(user_logged_in, dispatch_uid="analytics.signin")
def signed_in(sender, request, user, **kwargs):
    if visitor_segment(user) is not None:
        queue_action(request, "signin_success")


@receiver(user_signed_up, dispatch_uid="analytics.signup")
def signed_up(sender, request, user, **kwargs):
    if visitor_segment(user) is not None:
        queue_action(request, "signup_success")
        if request.POST.get("subscribe"):
            queue_action(request, "newsletter_optin")


@receiver(user_logged_out, dispatch_uid="analytics.signout")
def signed_out(sender, request, user, **kwargs):
    if visitor_segment(user) is not None:
        queue_action(request, "signout_success")
