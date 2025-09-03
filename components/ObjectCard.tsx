/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Product } from '../types';

// fix: Added optional onClick prop to make the component clickable and resolve type errors in consuming components.
interface ObjectCardProps {
    product: Product;
    isSelected: boolean;
    onClick?: () => void;
}

const ObjectCard: React.FC<ObjectCardProps> = ({ product, isSelected, onClick }) => {
    const cardClasses = `
        bg-white rounded-lg shadow-md overflow-hidden transition-all duration-300 h-full flex flex-col
        cursor-pointer hover:shadow-xl hover:scale-105
        ${isSelected ? 'border-2 border-blue-500 shadow-xl scale-105' : 'border border-zinc-200'}
    `;

    return (
        <div className={cardClasses} onClick={onClick}>
            <div className="aspect-square w-full bg-zinc-100 flex items-center justify-center flex-shrink-0">
                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" />
            </div>
            <div className="p-2 text-center mt-auto">
                <h4 className="text-xs font-semibold text-zinc-700 leading-tight">{product.name}</h4>
            </div>
        </div>
    );
};

export default ObjectCard;
