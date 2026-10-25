import { designSpecificationSchema } from '../../packages/shared/src/index.js';
export function sampleSpecification() {
  return designSpecificationSchema.parse({
    schemaVersion: '1.0.0',
    projectId: 'phase2-smoke',
    pages: [
      {
        id: 'app',
        name: 'App',
        screens: [
          {
            id: 'home',
            name: 'Magic UI Phase 2 smoke',
            direction: 'ltr',
            layout: {
              type: 'auto-layout',
              width: 400,
              height: 'hug',
              itemSpacing: 24,
              x: 500,
              y: 40,
              padding: { top: 24, right: 24, bottom: 24, left: 24 },
            },
            styling: { fills: [{ color: '#FFFFFF' }], cornerRadius: 16 },
            nodes: [
              {
                id: 'header',
                type: 'text',
                name: 'Header',
                content: 'Your workspace',
                fontFamily: 'Inter',
                fontStyle: 'Bold',
                fontSize: 24,
                layout: { width: 'fill', height: 'hug' },
                styling: { fills: [{ color: '#172033' }] },
              },
              {
                id: 'list',
                type: 'frame',
                name: 'List',
                layout: {
                  type: 'auto-layout',
                  width: 'fill',
                  height: 'hug',
                  itemSpacing: 12,
                },
                nodes: [
                  {
                    id: 'item-one',
                    type: 'text',
                    name: 'First item',
                    content: 'Design specification ready',
                    fontFamily: 'Inter',
                    fontStyle: 'Regular',
                    layout: { width: 'fill', height: 'hug' },
                    styling: { fills: [{ color: '#344054' }] },
                  },
                  {
                    id: 'item-two',
                    type: 'text',
                    name: 'Second item',
                    content: 'Stable identities connected',
                    fontFamily: 'Inter',
                    fontStyle: 'Regular',
                    layout: { width: 'fill', height: 'hug' },
                    styling: { fills: [{ color: '#344054' }] },
                  },
                ],
              },
              {
                id: 'button',
                type: 'frame',
                name: 'Continue button',
                layout: {
                  type: 'auto-layout',
                  direction: 'horizontal',
                  width: 'fill',
                  height: 48,
                  primaryAlignment: 'center',
                  alignment: 'center',
                },
                styling: { fills: [{ color: '#2463EB' }], cornerRadius: 8 },
                nodes: [
                  {
                    id: 'button-label',
                    type: 'text',
                    name: 'Button label',
                    content: 'Continue',
                    fontFamily: 'Inter',
                    fontStyle: 'Bold',
                    layout: { width: 'hug', height: 'hug' },
                    styling: { fills: [{ color: '#FFFFFF' }] },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
}
