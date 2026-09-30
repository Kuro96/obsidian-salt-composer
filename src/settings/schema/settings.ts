import { migrateSettings } from './migrations'
import {
  SmartComposerSettings,
  smartComposerSettingsSchema,
} from './setting.types'

export function parseSmartComposerSettings(
  data: unknown,
): SmartComposerSettings {
  try {
    const migratedData = migrateSettings(data)
    return smartComposerSettingsSchema.parse(migratedData)
  } catch (error) {
    console.warn('Invalid settings provided, using defaults:', error)
    return smartComposerSettingsSchema.parse({})
  }
}
