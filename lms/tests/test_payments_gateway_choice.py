# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

import frappe
from unittest import mock
from frappe.tests.utils import FrappeTestCase

from lms.lms import payments


class TestGatewayChoice(FrappeTestCase):
	def test_rejects_a_non_enabled_gateway(self):
		with mock.patch.object(
			payments,
			"get_enabled_payment_gateways",
			return_value=[{"name": "LyPay", "label": "LyPay"}],
		):
			with self.assertRaises(frappe.ValidationError):
				payments.validate_chosen_gateway("Plutu")

	def test_accepts_an_enabled_gateway(self):
		with mock.patch.object(
			payments,
			"get_enabled_payment_gateways",
			return_value=[{"name": "LyPay", "label": "LyPay"}],
		):
			self.assertEqual(payments.resolve_gateway("LyPay"), "LyPay")

	def test_falls_back_to_single_setting_when_none_chosen(self):
		with mock.patch.object(payments, "get_payment_gateway", return_value="Moamalat"):
			self.assertEqual(payments.resolve_gateway(None), "Moamalat")
