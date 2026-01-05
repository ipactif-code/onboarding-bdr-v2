declare module 'react-lazy-load-image-component' {
  import * as React from 'react';

  export interface LazyLoadImageProps {
    src: string;
    alt?: string;
    width?: number | string;
    height?: number | string;
    effect?: 'blur' | 'black-and-white' | 'opacity';
    placeholderSrc?: string;
    wrapperClassName?: string;
    className?: string;
    style?: React.CSSProperties;
    beforeLoad?: () => void;
    afterLoad?: () => void;
    onLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
    onError?: (error: Event) => void;
    threshold?: number;
    visibleByDefault?: boolean;
    scrollPosition?: { x: number; y: number };
    useIntersectionObserver?: boolean;
    delayTime?: number;
    delayMethod?: 'debounce' | 'throttle';
    wrapperProps?: React.HTMLAttributes<HTMLSpanElement>;
  }

  export const LazyLoadImage: React.FC<LazyLoadImageProps>;

  export interface LazyLoadComponentProps {
    children: React.ReactNode;
    placeholder?: React.ReactNode;
    scrollPosition?: { x: number; y: number };
    visibleByDefault?: boolean;
    threshold?: number;
  }

  export const LazyLoadComponent: React.FC<LazyLoadComponentProps>;

  export function trackWindowScroll<P>(
    component: React.ComponentType<P & { scrollPosition?: { x: number; y: number } }>
  ): React.ComponentType<P>;
}
