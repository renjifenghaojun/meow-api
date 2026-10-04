import type { TFunction } from 'i18next'
import { z } from 'zod'

import { parseHttpStatusCodeRules } from '@/lib/http-status-code-rules'

export function createRoutingPolicySchema(t: TFunction) {
  return z.object({
    RetryTimes: z.number().int().min(0).max(99),
    AutomaticRetryStatusCodes: z
      .string()
      .refine(
        (value) => parseHttpStatusCodeRules(value).ok,
        t('Invalid status code rules')
      ),
    channel_affinity_setting: z.object({
      enabled: z.boolean(),
      session_mode: z.enum(['', 'off', 'prefer', 'strict']),
      switch_on_success: z.boolean(),
      keep_on_channel_disabled: z.boolean(),
      max_entries: z.number().int().min(0),
      default_ttl_seconds: z.number().int().min(0),
      rules: z.string().superRefine((value, context) => {
        try {
          const rules: unknown = JSON.parse(value)
          if (!Array.isArray(rules)) {
            context.addIssue({
              code: 'custom',
              message: t('Rules JSON must be an array'),
            })
          }
        } catch {
          context.addIssue({
            code: 'custom',
            message: t('Invalid rules JSON format'),
          })
        }
      }),
    }),
    model_operator_setting: z.object({
      enabled: z.boolean(),
      model_channel_map: z.string().superRefine((value, context) => {
        let parsed: unknown
        try {
          parsed = JSON.parse(value)
        } catch {
          context.addIssue({
            code: 'custom',
            message: t('Invalid JSON format'),
          })
          return
        }
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          context.addIssue({
            code: 'custom',
            message: t('Model operator map must be a JSON object'),
          })
          return
        }
        for (const [model, channelId] of Object.entries(parsed)) {
          if (!model.trim()) {
            context.addIssue({
              code: 'custom',
              message: t('Model name must not be empty'),
            })
            return
          }
          if (
            typeof channelId !== 'number' ||
            !Number.isInteger(channelId) ||
            channelId <= 0
          ) {
            context.addIssue({
              code: 'custom',
              message: t('Channel id must be a positive integer for {{model}}', {
                model,
              }),
            })
            return
          }
        }
      }),
    }),
  })
}

export type RoutingPolicyFormValues = z.infer<
  ReturnType<typeof createRoutingPolicySchema>
>

export function routingPolicyFormValues(
  options: Record<string, string>
): RoutingPolicyFormValues {
  return {
    RetryTimes: Number(options.RetryTimes),
    AutomaticRetryStatusCodes: options.AutomaticRetryStatusCodes,
    channel_affinity_setting: {
      enabled: options['channel_affinity_setting.enabled'] === 'true',
      session_mode: (options['channel_affinity_setting.session_mode'] ||
        '') as RoutingPolicyFormValues['channel_affinity_setting']['session_mode'],
      switch_on_success:
        options['channel_affinity_setting.switch_on_success'] === 'true',
      keep_on_channel_disabled:
        options['channel_affinity_setting.keep_on_channel_disabled'] === 'true',
      max_entries: Number(options['channel_affinity_setting.max_entries']),
      default_ttl_seconds: Number(
        options['channel_affinity_setting.default_ttl_seconds']
      ),
      rules: options['channel_affinity_setting.rules'] || '[]',
    },
    model_operator_setting: {
      enabled: options['model_operator_setting.enabled'] === 'true',
      model_channel_map:
        options['model_operator_setting.model_channel_map'] || '{}',
    },
  }
}

export function routingPolicyOptions(
  values: RoutingPolicyFormValues
): Record<string, string> {
  return {
    RetryTimes: String(values.RetryTimes),
    AutomaticRetryStatusCodes: values.AutomaticRetryStatusCodes,
    ...Object.fromEntries(
      Object.entries(values.channel_affinity_setting).map(([key, value]) => [
        `channel_affinity_setting.${key}`,
        String(value),
      ])
    ),
    ...Object.fromEntries(
      Object.entries(values.model_operator_setting).map(([key, value]) => [
        `model_operator_setting.${key}`,
        String(value),
      ])
    ),
  }
}
