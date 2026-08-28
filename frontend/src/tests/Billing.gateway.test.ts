/** Billing.vue — buyer-selectable payment gateway on checkout. */
// When more than one gateway is enabled for checkout, the page must render a
// selector and send the buyer's choice as `payment_gateway`; with none chosen
// it must block rather than silently pay through the wrong gateway.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import Billing from '@/pages/Billing.vue'

type BillingAddress = Record<string, unknown>
type SubmittedCall = {
	url: string
	params: { address: BillingAddress; payment_gateway?: string }
}

const { toastMock, submitted, unhandled } = vi.hoisted(() => ({
	toastMock: { success: vi.fn(), error: vi.fn() },
	submitted: [] as SubmittedCall[],
	unhandled: [] as unknown[],
}))

const ACCESS_URL = 'lms.lms.api.validate_billing_access'
const SUMMARY_URL = 'lms.lms.utils.get_order_summary'
const PAYMENT_URL = 'lms.lms.payments.get_payment_link'
const GATEWAYS_URL = 'payments.utils.get_enabled_payment_gateways'

let addressFixture: Record<string, unknown> | null = null
let gatewaysFixture: { name: string; label: string }[] = []

const FIELD_META = {
	billing_name: { reqd: 1 },
	address_line1: { reqd: 1 },
	city: { reqd: 1 },
	state: { reqd: 0 },
	country: { reqd: 1, default: 'India' },
	pincode: { reqd: 0 },
	phone: { reqd: 0 },
	source: { reqd: 0 },
	gstin: { reqd: 0 },
	pan: { reqd: 0 },
}

// A paid course, so the selector's `!isZeroAmount` guard is satisfied.
const SUMMARY = {
	title: 'Batch',
	original_amount_formatted: '₹ 2,000',
	gst_amount_formatted: '₹ 360',
	total_amount_formatted: '₹ 2,360',
	total_amount: 2360,
	gst_applied: 360,
}

type ResourceParams = { address: BillingAddress } & Record<string, unknown>
type ResourceHandlers = {
	validate?: (
		params: ResourceParams
	) => string | undefined | Promise<string | undefined>
	onSuccess?: (data: unknown) => void
	onError?: (error: Error) => void
}
type ResourceOptions = ResourceHandlers & {
	url: string
	auto?: boolean
	params?: ResourceParams
	makeParams?: (values?: unknown) => ResourceParams
}

const dataFor = (url: string) => {
	if (url === ACCESS_URL) {
		return {
			access: true,
			message: '',
			address: addressFixture,
			billing_field_meta: FIELD_META,
		}
	}
	if (url === SUMMARY_URL) return SUMMARY
	if (url === GATEWAYS_URL) return gatewaysFixture
	return null
}

// Mirrors frappe-ui's resource contract: makeParams builds the params, validate()
// runs after and aborts the fetch with a string message, and `auto` fetches once
// on creation (used by the enabled-gateways resource).
const createResourceMock = (opts: ResourceOptions) => {
	const res = reactive({
		data: null as unknown,
		loading: false,
		error: null as Error | null,
		reload: vi.fn(),
		submit: vi.fn(async (values?: unknown, handlers: ResourceHandlers = {}) => {
			const params = opts.makeParams ? opts.makeParams(values) : opts.params
			const validate = handlers.validate || opts.validate
			if (validate && params) {
				const message = await validate(params)
				if (message && typeof message === 'string') {
					const error = new Error(message)
					const handlerFns = [opts.onError, handlers.onError].filter(Boolean)
					if (!handlerFns.length) unhandled.push(error)
					handlerFns.forEach((fn) => fn?.(error))
					return
				}
			}
			submitted.push({
				url: opts.url,
				params: JSON.parse(JSON.stringify(params)),
			})
			const data = dataFor(opts.url)
			if (data !== null) {
				res.data = data
				opts.onSuccess?.(data)
			}
		}),
	})
	if (opts.auto) res.submit()
	return res
}

vi.mock('frappe-ui', () => ({
	toast: toastMock,
	call: vi.fn(),
	usePageMeta: vi.fn(),
	createResource: (opts: ResourceOptions) => createResourceMock(opts),
	Breadcrumbs: { template: '<div />' },
	Button: {
		emits: ['click'],
		template: `<button @click="$emit('click')"><slot /></button>`,
	},
	FormControl: {
		props: [
			'modelValue',
			'label',
			'type',
			'required',
			'disabled',
			'placeholder',
		],
		emits: ['update:modelValue', 'input'],
		template: `<input
			:data-testid="'fc-' + label"
			:type="type || 'text'"
			:value="modelValue"
			@change="$emit('update:modelValue', type === 'checkbox' ? $event.target.checked : $event.target.value)"
		/>`,
	},
	Combobox: {
		props: ['modelValue', 'options', 'label', 'required', 'placeholder'],
		emits: ['update:modelValue'],
		template: `<select
			:data-testid="'combobox-' + label"
			:value="modelValue"
			@change="$emit('update:modelValue', $event.target.value)"
		>
			<option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
		</select>`,
	},
}))

vi.mock('frappe-ui/frappe', () => ({
	useTelemetry: () => ({ capture: vi.fn() }),
}))
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: { favicon: '' } }),
}))
vi.mock('@/components/NotPermitted.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/Controls/Link.vue', () => ({
	default: {
		props: ['value', 'doctype', 'label', 'required'],
		emits: ['change'],
		template: `<select
			:data-testid="'link-' + label"
			:value="value"
			@change="$emit('change', $event.target.value)"
		/>`,
	},
}))
vi.mock('@/utils/basePath', () => ({ getLmsRoute: (r: string) => `/lms/${r}` }))

vi.stubGlobal('__', (s: string) => s)

const address = (over: Record<string, unknown> = {}) => ({
	billing_name: 'Channeltech Systems Pvt Ltd',
	address_line1: 'Best Paper Mill Compound',
	address_line2: '',
	city: 'Vapi',
	state: 'Gujarat',
	country: 'India',
	pincode: '396195',
	phone: '9974447180',
	...over,
})

const mountBilling = async (
	gateways: { name: string; label: string }[],
	over: Record<string, unknown> = {}
) => {
	addressFixture = address(over)
	gatewaysFixture = gateways
	const wrapper = mount(Billing, {
		props: { type: 'batch', name: 'BATCH-01' },
		global: {
			provide: { $user: { data: { name: 'a@b.c' } } },
			mocks: { __: (s: string) => s },
			stubs: { RouterLink: true },
		},
	})
	await flushPromises()
	return wrapper
}

const consent = async (wrapper: VueWrapper) => {
	const box = wrapper
		.findAll('input[type="checkbox"]')
		.find((i) => i.attributes('data-testid')?.includes('consent'))
	if (!box) throw new Error('consent checkbox not rendered')
	await box.setValue(true)
}

const proceed = async (wrapper: VueWrapper) => {
	const button = wrapper
		.findAll('button')
		.find((b) => b.text().includes('Proceed to Payment'))
	if (!button) throw new Error('checkout button not rendered')
	await button.trigger('click')
	await flushPromises()
}

const checkout = () => submitted.find((s) => s.url === PAYMENT_URL)

describe('Billing — buyer-selectable payment gateway', () => {
	beforeEach(() => {
		submitted.length = 0
		unhandled.length = 0
		vi.clearAllMocks()
	})

	it('renders a gateway selector and submits the chosen gateway', async () => {
		const wrapper = await mountBilling([
			{ name: 'LyPay', label: 'LyPay' },
			{ name: 'Moamalat', label: 'Moamalat' },
		])

		const radios = wrapper.findAll('input[type="radio"][name="payment_gateway"]')
		expect(radios.map((r) => r.attributes('value'))).toEqual([
			'LyPay',
			'Moamalat',
		])

		const chosen = radios.find((r) => r.attributes('value') === 'Moamalat')!
		await chosen.setValue()
		await consent(wrapper)
		await proceed(wrapper)

		expect(toastMock.error).not.toHaveBeenCalled()
		expect(checkout()?.params.payment_gateway).toBe('Moamalat')
	})

	it('blocks checkout when more than one gateway is offered but none is chosen', async () => {
		const wrapper = await mountBilling([
			{ name: 'LyPay', label: 'LyPay' },
			{ name: 'Moamalat', label: 'Moamalat' },
		])

		await consent(wrapper)
		await proceed(wrapper)

		expect(checkout()).toBeFalsy()
		expect(unhandled).toHaveLength(0)
		expect(toastMock.error).toHaveBeenCalledWith(
			'Please choose a payment method.'
		)
	})

	it('auto-selects and hides the selector when only one gateway is enabled', async () => {
		const wrapper = await mountBilling([{ name: 'LyPay', label: 'LyPay' }])

		expect(
			wrapper.findAll('input[type="radio"][name="payment_gateway"]')
		).toHaveLength(0)

		await consent(wrapper)
		await proceed(wrapper)

		expect(checkout()?.params.payment_gateway).toBe('LyPay')
	})
})
