import React from 'react';
import { clsx } from 'clsx';
import { CATEGORY_MAPPINGS } from '../utils/categories';

const CategoryFilter = ({ selectedCategories, onToggle }) => {
    return (
        <div className="w-full pb-4">
            <div className="flex flex-wrap justify-center gap-3 px-1">
                {CATEGORY_MAPPINGS.map((cat) => {
                    const isSelected = selectedCategories.includes(cat.id);
                    return (
                        <button
                            key={cat.id}
                            onClick={() => onToggle(cat.id)}
                            className={clsx(
                                "flex items-center space-x-2 px-4 py-2 rounded-full border transition-all duration-200",
                                isSelected
                                    ? "bg-ink text-white border-ink shadow-md scale-105"
                                    : "bg-white text-gray-600 border-stone-200 hover:border-ink hover:text-ink"
                            )}
                        >
                            <span className="text-lg">{cat.icon}</span>
                            <span className="text-sm font-medium">{cat.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default CategoryFilter;
