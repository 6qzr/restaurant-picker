export const CATEGORY_MAPPINGS = [
    {
        id: 'cafe',
        label: 'Coffee & Tea',
        icon: '☕',
        types: ['cafe', 'coffee_shop', 'bakery']
    },
    {
        id: 'fast_food',
        label: 'Fast Food',
        icon: '🍔',
        types: ['fast_food_restaurant', 'meal_takeaway', 'hamburger_restaurant']
    },
    {
        id: 'pizza',
        label: 'Pizza',
        icon: '🍕',
        types: ['pizza_restaurant']
    },
    {
        id: 'asian',
        label: 'Asian',
        icon: '🍣',
        types: ['japanese_restaurant', 'chinese_restaurant', 'thai_restaurant', 'sushi_restaurant', 'ramen_restaurant']
    },
    {
        id: 'arabian',
        label: 'Arabian',
        icon: '🍢',
        types: ['middle_eastern_restaurant', 'lebanese_restaurant', 'mediterranean_restaurant']
    },
    {
        id: 'mexican',
        label: 'Mexican',
        icon: '🌮',
        types: ['mexican_restaurant', 'taco_restaurant']
    },
    {
        id: 'italian',
        label: 'Italian',
        icon: '🍝',
        types: ['italian_restaurant']
    },
    {
        id: 'healthy',
        label: 'Healthy',
        icon: '🥗',
        types: ['vegan_restaurant', 'vegetarian_restaurant', 'salad_shop']
    },
    {
        id: 'dessert',
        label: 'Dessert',
        icon: '🍦',
        types: ['ice_cream_shop', 'dessert_shop', 'bakery']
    }
];

// Helper to get all types if nothing selected
export const getAllRestaurantTypes = () => {
    return ['restaurant', 'cafe', 'bakery', 'meal_takeaway'];
};
