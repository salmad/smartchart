/**
 * Animation Utilities for SmartChart
 * Professional, subtle animations with accessibility support
 */

import confetti from 'canvas-confetti';
import { type Variants } from 'framer-motion';

// ============================================================================
// Framer Motion Variants for Common Animations
// ============================================================================

/**
 * Fade in animation with slight upward movement
 */
export const fadeInUp: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  }
};

/**
 * Fade in animation without movement
 */
export const fadeIn: Variants = {
  hidden: {
    opacity: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  visible: {
    opacity: 1,
    transition: { duration: 0.3, ease: 'easeOut' }
  }
};

/**
 * Scale animation with fade
 */
export const scaleIn: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: 'easeOut' }
  }
};

/**
 * Slide in from left
 */
export const slideInLeft: Variants = {
  hidden: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  }
};

/**
 * Slide in from right
 */
export const slideInRight: Variants = {
  hidden: {
    opacity: 0,
    x: 20,
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  }
};

/**
 * Stagger container for child animations
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05
    }
  }
};

/**
 * Stagger item for use within staggerContainer
 */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  }
};

// ============================================================================
// Celebration Effects
// ============================================================================

/**
 * Subtle confetti celebration for success states
 * Professional and minimal - respects user preferences
 */
export const triggerSuccessConfetti = (origin?: { x: number; y: number }) => {
  // Check for reduced motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const defaults = {
    spread: 360,
    ticks: 50,
    gravity: 0.8,
    decay: 0.94,
    startVelocity: 20,
    colors: ['#8B5CF6', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B']
  };

  const shoot = () => {
    confetti({
      ...defaults,
      particleCount: 30,
      scalar: 0.8,
      shapes: ['circle'],
      origin: origin || { x: 0.5, y: 0.5 }
    });
  };

  setTimeout(shoot, 0);
  setTimeout(shoot, 100);
};

/**
 * Very subtle confetti burst for micro-celebrations
 */
export const triggerMicroConfetti = (element?: HTMLElement) => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const rect = element?.getBoundingClientRect();
  const origin = rect
    ? {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight
      }
    : { x: 0.5, y: 0.5 };

  confetti({
    particleCount: 15,
    spread: 60,
    ticks: 40,
    gravity: 0.8,
    decay: 0.95,
    startVelocity: 15,
    scalar: 0.6,
    colors: ['#8B5CF6', '#3B82F6', '#10B981'],
    origin
  });
};

// ============================================================================
// Scroll Animations
// ============================================================================

/**
 * Hook for detecting when element enters viewport
 */
export const useIntersectionObserver = (
  callback: (isIntersecting: boolean) => void,
  options?: IntersectionObserverInit
) => {
  const defaultOptions: IntersectionObserverInit = {
    threshold: 0.1,
    rootMargin: '0px 0px -10% 0px',
    ...options
  };

  return (element: HTMLElement | null) => {
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      callback(entry.isIntersecting);
    }, defaultOptions);

    observer.observe(element);

    return () => observer.disconnect();
  };
};

// ============================================================================
// Chart Animation Utilities
// ============================================================================

/**
 * Generate smooth transition config for chart type changes
 */
export const getChartTransition = () => ({
  duration: 500,
  ease: 'easeInOut'
});

/**
 * Stagger delay calculator for chart data series
 */
export const getSeriesStaggerDelay = (index: number, total: number) => {
  const baseDelay = 100;
  const maxDelay = 400;
  const stagger = Math.min(maxDelay / total, baseDelay);
  return index * stagger;
};

// ============================================================================
// Loading Animations
// ============================================================================

/**
 * Typing indicator dots animation states
 */
export const typingDots = {
  dot1: {
    y: [0, -8, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      ease: 'easeInOut',
      delay: 0
    }
  },
  dot2: {
    y: [0, -8, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      ease: 'easeInOut',
      delay: 0.2
    }
  },
  dot3: {
    y: [0, -8, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      ease: 'easeInOut',
      delay: 0.4
    }
  }
};

// ============================================================================
// Accessibility Utilities
// ============================================================================

/**
 * Check if user prefers reduced motion
 */
export const prefersReducedMotion = (): boolean => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Get safe animation duration based on user preference
 * Returns 0 if reduced motion is preferred, otherwise returns provided duration
 */
export const getSafeAnimationDuration = (duration: number): number => {
  return prefersReducedMotion() ? 0 : duration;
};

/**
 * Spring animation config for subtle, professional interactions
 */
export const springConfig = {
  type: 'spring',
  stiffness: 260,
  damping: 20
} as const;

/**
 * Gentle spring for hoverable elements
 */
export const gentleSpring = {
  type: 'spring',
  stiffness: 300,
  damping: 25
} as const;
