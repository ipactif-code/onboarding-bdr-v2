import { BaseCalloutPlugin } from '@platejs/callout';

import { CalloutElement } from '@/components/ui/callout-node';

export const BaseCalloutKit = [
  BaseCalloutPlugin.withComponent(CalloutElement),
];
