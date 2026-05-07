/**
 * usePermissions Composable
 *
 * Provides permission checking utilities for Vue components
 */

import { computed } from 'vue'
import { usePermissionsStore } from '@/stores/permissions'
import { useRoomStore } from '@/stores/room'

export function usePermissions() {
  const permissionsStore = usePermissionsStore()
  const roomStore = useRoomStore()

  /**
   * Check if user can perform an action
   * Returns a computed boolean for use in v-if/v-show
   *
   * @param {string} category - Permission category (e.g., 'fog', 'markers')
   * @param {string} action - Specific action (e.g., 'reveal', 'add')
   * @returns {ComputedRef<boolean>} Reactive permission check
   *
   * @example
   * const { can } = usePermissions()
   * const canAddMarker = can('markers', 'add')
   * // Use in template: v-if="canAddMarker"
   */
  const can = (category, action) => {
    return computed(() => permissionsStore.canPerformAction(category, action))
  }

  /**
   * Check if user has any permission in a category
   *
   * @param {string} category - Permission category
   * @returns {ComputedRef<boolean>} True if any action in category is permitted
   *
   * @example
   * const { hasAnyIn } = usePermissions()
   * const hasAnyMapControl = hasAnyIn('mapControls')
   */
  const hasAnyIn = (category) => {
    return computed(() => permissionsStore.hasAnyPermissionIn(category))
  }

  /**
   * Wrap a handler function with permission check
   * If permission is denied, the handler will not execute
   *
   * @param {string} category - Permission category
   * @param {string} action - Specific action
   * @param {Function} handler - Handler function to wrap
   * @param {Object} options - Optional configuration
   * @param {boolean} options.showFeedback - Show console warning on deny
   * @returns {Function} Wrapped handler function
   *
   * @example
   * const { guardAction } = usePermissions()
   * const handleClick = guardAction('markers', 'add', (event) => {
   *   // This only runs if user has permission
   *   addMarker(event)
   * })
   */
  const guardAction = (category, action, handler, options = {}) => {
    return (...args) => {
      if (!permissionsStore.canPerformAction(category, action)) {
        if (options.showFeedback) {
          console.warn(`[Permissions] Action denied: ${category}.${action}`)
        }
        return
      }

      return handler(...args)
    }
  }

  /**
   * Check permission and return early if denied
   * Useful for early returns in handler functions
   *
   * @param {string} category - Permission category
   * @param {string} action - Specific action
   * @returns {boolean} True if permission granted, false otherwise
   *
   * @example
   * function handleClick(event) {
   *   if (!checkPermission('markers', 'add')) return
   *   // Continue with action...
   * }
   */
  const checkPermission = (category, action) => {
    return permissionsStore.canPerformAction(category, action)
  }

  return {
    can,
    hasAnyIn,
    guardAction,
    checkPermission,
    isOwner: computed(() => roomStore.isOwner)
  }
}
