/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface Product {
  id: number;
  name: string;
  imageUrl: string;
  surfaceType: 'wall' | 'floor';
  category: string;
  applicationType: 'tile' | 'single';
}
