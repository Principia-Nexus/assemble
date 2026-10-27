import pytest

from assemble.services import mailer


def test_sendable_refuses_reserved_and_empty_addresses():
    assert mailer.sendable("ana@acme.com")
    assert not any(mailer.sendable(e) for e in ("", None, "a@example.com", "b@site.test", "c@host.invalid"))


@pytest.mark.parametrize("html", ['<form><input name="password"></form>', '<a href="https://bit.ly/x">Open</a>',
                                  '<a href="https://evil.io/x">https://assemble.app</a>', '<a href="http://assemble.app/x">Open</a>'])
def test_unsafe_email_is_refused(html):
    with pytest.raises(ValueError):
        mailer._assert_safe_email("Hello", html)


def test_invitation_and_code_emails_pass():
    subject, _, html = mailer.invitation("Acme", "Grid job", "Volt Electric", "https://assemble.avorant.com/review/tok")
    mailer._assert_safe_email(subject, html)
    mailer._assert_safe_email("Your Assemble code", mailer.code_html("123456"))
