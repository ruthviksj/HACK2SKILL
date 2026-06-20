/* ==========================================
   CookPlan AI — Application Logic
   Gemini API integration, state management,
   and interactive cooking plan features
   ========================================== */

// ===== STATE =====
let currentProfile = null;
let currentPlan = null;
let demoMode = false;
let isGenerating = false;

// ===== CONSTANTS =====
const STORAGE_KEYS = {
  profile: 'cookplan_profile',
  plan: 'cookplan_current_plan',
  apiKey: 'cookplan_api_key',
  demoMode: 'cookplan_demo_mode',
};

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const MEAL_EMOJIS = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍿',
};

const CURRENCY_SYMBOLS = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  loadSavedState();
  initFormFromProfile();
});

function loadSavedState() {
  // Load API key
  const savedKey = localStorage.getItem(STORAGE_KEYS.apiKey);
  if (savedKey) {
    document.getElementById('input-api-key').value = savedKey;
  }

  // Load demo mode
  demoMode = localStorage.getItem(STORAGE_KEYS.demoMode) === 'true';

  // Load profile
  const savedProfile = localStorage.getItem(STORAGE_KEYS.profile);
  if (savedProfile) {
    try {
      currentProfile = JSON.parse(savedProfile);
    } catch (e) {
      console.warn('Failed to parse saved profile:', e);
    }
  }

  // Load plan
  const savedPlan = localStorage.getItem(STORAGE_KEYS.plan);
  if (savedPlan) {
    try {
      currentPlan = JSON.parse(savedPlan);
    } catch (e) {
      console.warn('Failed to parse saved plan:', e);
    }
  }
}

function initFormFromProfile() {
  if (!currentProfile) return;
  const p = currentProfile;

  setVal('input-name', p.name);
  setVal('input-family-size', p.familySize);
  setVal('input-diet', p.dietaryPreference);
  setVal('input-allergies', (p.allergies || []).join(', '));
  setVal('input-skill', p.skillLevel);
  setVal('input-meals', p.mealsPerDay);
  setVal('input-schedule', p.cookingTimeWindow);
  setVal('input-budget', p.budget);
  setVal('input-currency', p.currency || 'INR');
  setVal('input-ingredients', (p.availableIngredients || []).join(', '));

  // Restore cuisine chips
  if (p.cuisinePreferences) {
    document.querySelectorAll('#cuisine-chips .chip').forEach(chip => {
      if (p.cuisinePreferences.includes(chip.dataset.value)) {
        chip.classList.add('selected');
      }
    });
  }
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) el.value = val;
}

// ===== VIEW MANAGEMENT =====
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById(viewId);
  if (view) view.classList.add('active');

  // Scroll to top
  window.scrollTo(0, 0);
}

// ===== CHIP TOGGLE =====
function toggleChip(el) {
  el.classList.toggle('selected');
}

function getSelectedCuisines() {
  return Array.from(document.querySelectorAll('#cuisine-chips .chip.selected'))
    .map(c => c.dataset.value);
}

// ===== PROFILE MANAGEMENT =====
function gatherProfile() {
  const allergiesRaw = document.getElementById('input-allergies').value.trim();
  const ingredientsRaw = document.getElementById('input-ingredients').value.trim();

  return {
    name: document.getElementById('input-name').value.trim(),
    familySize: parseInt(document.getElementById('input-family-size').value) || 2,
    dietaryPreference: document.getElementById('input-diet').value,
    allergies: allergiesRaw ? allergiesRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
    cuisinePreferences: getSelectedCuisines(),
    skillLevel: document.getElementById('input-skill').value,
    mealsPerDay: parseInt(document.getElementById('input-meals').value) || 3,
    cookingTimeWindow: document.getElementById('input-schedule').value.trim(),
    budget: parseFloat(document.getElementById('input-budget').value) || 500,
    currency: document.getElementById('input-currency').value || 'INR',
    availableIngredients: ingredientsRaw ? ingredientsRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
    updatedAt: new Date().toISOString(),
  };
}

function saveProfile(profile) {
  currentProfile = profile;
  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
}

// ===== API KEY MANAGEMENT =====
function toggleApiModal() {
  document.getElementById('api-modal').classList.toggle('active');
}

function closeModalOutside(e) {
  if (e.target === e.currentTarget) {
    toggleApiModal();
  }
}

function saveApiKey() {
  const key = document.getElementById('input-api-key').value.trim();
  if (!key) {
    alert('Please enter a valid API key');
    return;
  }
  localStorage.setItem(STORAGE_KEYS.apiKey, key);
  demoMode = false;
  localStorage.setItem(STORAGE_KEYS.demoMode, 'false');
  toggleApiModal();
}

function useDemoMode() {
  demoMode = true;
  localStorage.setItem(STORAGE_KEYS.demoMode, 'true');
  toggleApiModal();
}

function getApiKey() {
  return localStorage.getItem(STORAGE_KEYS.apiKey) || '';
}

// ===== PLAN GENERATION =====
async function handleGeneratePlan(event) {
  event.preventDefault();
  if (isGenerating) return;

  const profile = gatherProfile();

  // Validate
  if (!profile.name) {
    alert('Please enter your name');
    return;
  }
  if (!profile.dietaryPreference) {
    alert('Please select your dietary preference');
    return;
  }
  if (profile.budget <= 0) {
    alert('Please enter a valid budget');
    return;
  }

  // Check API key or demo mode
  if (!demoMode && !getApiKey()) {
    toggleApiModal();
    return;
  }

  // Save profile
  saveProfile(profile);

  // Show loading
  showView('view-loading');
  isGenerating = true;
  startLoadingAnimation();

  try {
    let plan;
    if (demoMode) {
      // Simulate delay for demo
      await delay(3000);
      plan = generateDemoPlan(profile);
    } else {
      plan = await generatePlanWithGemini(profile);
    }

    currentPlan = plan;
    localStorage.setItem(STORAGE_KEYS.plan, JSON.stringify(plan));

    // Complete loading animation
    await completeLoadingAnimation();

    // Render plan
    renderPlan(plan, profile);
    showView('view-plan');
  } catch (error) {
    console.error('Generation failed:', error);
    document.getElementById('error-message').textContent =
      error.message || 'We couldn\'t generate your cooking plan. Please try again.';
    showView('view-error');
  } finally {
    isGenerating = false;
  }
}

function regeneratePlan() {
  if (!currentProfile || isGenerating) return;
  handleGeneratePlan(new Event('submit'));
}

function retryGeneration() {
  if (!currentProfile) {
    showView('view-profile');
    return;
  }
  handleGeneratePlan(new Event('submit'));
}

// ===== LOADING ANIMATION =====
let loadingInterval = null;

function startLoadingAnimation() {
  // Reset
  const steps = ['lstep-1', 'lstep-2', 'lstep-3', 'lstep-4'];
  steps.forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('active', 'done');
  });
  document.getElementById('lstep-1').classList.add('active');

  // Reset loading bar animation
  const bar = document.querySelector('.loading-bar-fill');
  bar.style.animation = 'none';
  bar.offsetHeight; // trigger reflow
  bar.style.animation = '';

  let step = 0;
  loadingInterval = setInterval(() => {
    step++;
    if (step >= steps.length) {
      clearInterval(loadingInterval);
      return;
    }
    // Mark previous as done
    document.getElementById(steps[step - 1]).classList.remove('active');
    document.getElementById(steps[step - 1]).classList.add('done');
    // Mark current as active
    document.getElementById(steps[step]).classList.add('active');
  }, 1500);
}

async function completeLoadingAnimation() {
  clearInterval(loadingInterval);
  const steps = ['lstep-1', 'lstep-2', 'lstep-3', 'lstep-4'];
  steps.forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('active');
    el.classList.add('done');
  });

  const bar = document.querySelector('.loading-bar-fill');
  bar.style.animation = 'none';
  bar.style.width = '100%';

  await delay(500);
}

// ===== GEMINI API INTEGRATION =====
async function generatePlanWithGemini(profile) {
  const apiKey = getApiKey();
  const currencySymbol = CURRENCY_SYMBOLS[profile.currency] || '₹';

  const prompt = buildPrompt(profile, currencySymbol);

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.8,
        topP: 0.95,
        topK: 40,
        responseMimeType: 'application/json',
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 403 || response.status === 401) {
      throw new Error('Invalid API key. Please check your Gemini API key in settings.');
    }
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    }
    throw new Error(errorData?.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();

  // Extract text from response
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Empty response from AI. Please try again.');
  }

  // Parse JSON
  try {
    const plan = JSON.parse(text);
    return validateAndNormalizePlan(plan, profile);
  } catch (e) {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      const plan = JSON.parse(jsonMatch[1]);
      return validateAndNormalizePlan(plan, profile);
    }
    throw new Error('Could not parse AI response. Please try again.');
  }
}

function buildPrompt(profile, currencySymbol) {
  return `You are a professional meal planner and chef. Create a detailed daily cooking plan.

USER PROFILE:
- Name: ${profile.name}
- Family size: ${profile.familySize} people
- Diet: ${profile.dietaryPreference}
- Allergies/restrictions: ${profile.allergies.length > 0 ? profile.allergies.join(', ') : 'None'}
- Preferred cuisines: ${profile.cuisinePreferences.length > 0 ? profile.cuisinePreferences.join(', ') : 'Any'}
- Cooking skill: ${profile.skillLevel}
- Meals per day: ${profile.mealsPerDay}
- Cooking schedule: ${profile.cookingTimeWindow || 'Flexible'}
- Daily budget: ${currencySymbol}${profile.budget}
- Available ingredients: ${profile.availableIngredients.length > 0 ? profile.availableIngredients.join(', ') : 'None specified'}

Generate a JSON response with this EXACT structure:
{
  "meals": [
    {
      "type": "breakfast|lunch|dinner|snack",
      "name": "Meal name",
      "description": "One-line description",
      "prepTime": 10,
      "cookTime": 15,
      "estimatedCost": 150,
      "difficulty": "easy|medium|hard",
      "servings": 2,
      "steps": [
        {
          "instruction": "Step description",
          "duration": 5
        }
      ],
      "ingredients": [
        {
          "name": "Ingredient name",
          "quantity": "200g",
          "estimatedCost": 30,
          "category": "vegetables|fruits|dairy|grains|protein|spices|other"
        }
      ]
    }
  ],
  "shoppingList": [
    {
      "name": "Item name",
      "quantity": "Amount needed",
      "estimatedCost": 30,
      "category": "vegetables|fruits|dairy|grains|protein|spices|other"
    }
  ],
  "totalCost": 450,
  "totalPrepTime": 90,
  "tips": ["Helpful cooking tip 1", "Helpful cooking tip 2"]
}

RULES:
1. Create exactly ${profile.mealsPerDay} meals matching the requested meal types
2. Total cost MUST be within budget of ${currencySymbol}${profile.budget}
3. All costs in ${profile.currency}
4. Respect dietary preference: ${profile.dietaryPreference}
5. Avoid ALL listed allergies
6. Match cooking skill level: ${profile.skillLevel}
7. Each step should be clear and actionable
8. Shopping list should EXCLUDE ingredients the user already has: ${profile.availableIngredients.join(', ')}
9. Include realistic prices for the local market
10. Make meals diverse and appetizing`;
}

function validateAndNormalizePlan(plan, profile) {
  // Ensure required fields
  if (!plan.meals || !Array.isArray(plan.meals)) {
    throw new Error('Invalid plan structure');
  }

  const currencySymbol = CURRENCY_SYMBOLS[profile.currency] || '₹';

  // Normalize meals
  plan.meals = plan.meals.map((meal, i) => ({
    id: `meal-${i}`,
    type: meal.type || ['breakfast', 'lunch', 'dinner', 'snack'][i] || 'meal',
    name: meal.name || 'Unnamed Meal',
    description: meal.description || '',
    prepTime: meal.prepTime || 10,
    cookTime: meal.cookTime || 15,
    estimatedCost: meal.estimatedCost || 0,
    difficulty: meal.difficulty || 'easy',
    servings: meal.servings || profile.familySize,
    steps: (meal.steps || []).map((step, j) => ({
      id: `step-${i}-${j}`,
      order: j + 1,
      instruction: step.instruction || step.step || '',
      duration: step.duration || 5,
      completed: false,
    })),
    ingredients: (meal.ingredients || []).map(ing => ({
      name: ing.name || '',
      quantity: ing.quantity || '',
      estimatedCost: ing.estimatedCost || 0,
      category: ing.category || 'other',
      userHas: profile.availableIngredients.some(
        a => a.toLowerCase().includes(ing.name?.toLowerCase()) ||
             ing.name?.toLowerCase().includes(a.toLowerCase())
      ),
    })),
  }));

  // Normalize shopping list
  if (!plan.shoppingList || !Array.isArray(plan.shoppingList)) {
    // Build from ingredients
    plan.shoppingList = [];
    plan.meals.forEach(meal => {
      meal.ingredients.forEach(ing => {
        if (!ing.userHas && !plan.shoppingList.find(s => s.name === ing.name)) {
          plan.shoppingList.push({
            name: ing.name,
            quantity: ing.quantity,
            estimatedCost: ing.estimatedCost,
            category: ing.category,
            purchased: false,
          });
        }
      });
    });
  } else {
    plan.shoppingList = plan.shoppingList.map(item => ({
      ...item,
      purchased: false,
    }));
  }

  // Calculate totals
  plan.totalCost = plan.totalCost || plan.meals.reduce((s, m) => s + (m.estimatedCost || 0), 0);
  plan.totalPrepTime = plan.totalPrepTime || plan.meals.reduce((s, m) => s + (m.prepTime || 0) + (m.cookTime || 0), 0);
  plan.tips = plan.tips || [];
  plan.generatedAt = new Date().toISOString();
  plan.currency = profile.currency;
  plan.currencySymbol = currencySymbol;

  return plan;
}

// ===== DEMO PLAN GENERATOR =====
function generateDemoPlan(profile) {
  const currencySymbol = CURRENCY_SYMBOLS[profile.currency] || '₹';
  const isVeg = ['vegetarian', 'vegan', 'eggetarian'].includes(profile.dietaryPreference);
  const isVegan = profile.dietaryPreference === 'vegan';
  const budget = profile.budget;
  const mealBudget = Math.floor(budget / profile.mealsPerDay);

  const mealTemplates = {
    breakfast: isVegan ? {
      name: 'Avocado Toast with Chickpea Scramble',
      description: 'Creamy avocado on crispy toast with protein-packed spiced chickpeas',
      prepTime: 10,
      cookTime: 12,
      estimatedCost: Math.min(mealBudget, Math.round(budget * 0.25)),
      difficulty: 'easy',
      steps: [
        { instruction: 'Toast the bread slices until golden and crispy', duration: 3 },
        { instruction: 'While toast is browning, mash avocado with salt, pepper, and a squeeze of lemon juice', duration: 2 },
        { instruction: 'Heat oil in a pan, add diced onions and cook until translucent', duration: 3 },
        { instruction: 'Add drained chickpeas, turmeric, cumin, and a pinch of black salt. Mash slightly and cook for 4 minutes', duration: 5 },
        { instruction: 'Spread avocado on toast, top with chickpea scramble, garnish with chili flakes and fresh herbs', duration: 2 },
      ],
      ingredients: [
        { name: 'Bread', quantity: `${profile.familySize * 2} slices`, estimatedCost: Math.round(mealBudget * 0.15), category: 'grains' },
        { name: 'Avocado', quantity: `${Math.ceil(profile.familySize / 2)}`, estimatedCost: Math.round(mealBudget * 0.3), category: 'fruits' },
        { name: 'Chickpeas (canned)', quantity: '1 can (400g)', estimatedCost: Math.round(mealBudget * 0.2), category: 'protein' },
        { name: 'Onion', quantity: '1 medium', estimatedCost: Math.round(mealBudget * 0.05), category: 'vegetables' },
        { name: 'Lemon', quantity: '1', estimatedCost: Math.round(mealBudget * 0.05), category: 'fruits' },
        { name: 'Turmeric powder', quantity: '1/2 tsp', estimatedCost: Math.round(mealBudget * 0.05), category: 'spices' },
        { name: 'Olive oil', quantity: '2 tbsp', estimatedCost: Math.round(mealBudget * 0.1), category: 'other' },
      ],
    } : isVeg ? {
      name: 'Masala Dosa with Coconut Chutney',
      description: 'Crispy golden dosa filled with spiced potato masala, served with fresh coconut chutney',
      prepTime: 15,
      cookTime: 20,
      estimatedCost: Math.min(mealBudget, Math.round(budget * 0.25)),
      difficulty: 'medium',
      steps: [
        { instruction: 'If using pre-made batter, bring it to room temperature. If making fresh, blend soaked rice and urad dal into smooth batter', duration: 5 },
        { instruction: 'Boil potatoes until tender, peel and mash roughly. Sauté mustard seeds, curry leaves, onions, and green chillies in oil', duration: 8 },
        { instruction: 'Add turmeric, mashed potatoes, and salt. Mix well for the masala filling', duration: 3 },
        { instruction: 'Heat a non-stick tawa, spread a ladleful of batter in circular motion to make thin crepes. Drizzle oil around edges', duration: 5 },
        { instruction: 'When dosa turns golden, place potato masala in center, fold and serve hot with coconut chutney', duration: 4 },
      ],
      ingredients: [
        { name: 'Dosa batter', quantity: '500ml', estimatedCost: Math.round(mealBudget * 0.25), category: 'grains' },
        { name: 'Potatoes', quantity: `${profile.familySize} medium`, estimatedCost: Math.round(mealBudget * 0.15), category: 'vegetables' },
        { name: 'Onion', quantity: '2 medium', estimatedCost: Math.round(mealBudget * 0.08), category: 'vegetables' },
        { name: 'Mustard seeds', quantity: '1 tsp', estimatedCost: Math.round(mealBudget * 0.05), category: 'spices' },
        { name: 'Curry leaves', quantity: '1 sprig', estimatedCost: Math.round(mealBudget * 0.05), category: 'spices' },
        { name: 'Coconut (fresh)', quantity: '1/2 cup grated', estimatedCost: Math.round(mealBudget * 0.15), category: 'other' },
        { name: 'Green chillies', quantity: '2-3', estimatedCost: Math.round(mealBudget * 0.05), category: 'vegetables' },
        { name: 'Oil', quantity: '3 tbsp', estimatedCost: Math.round(mealBudget * 0.08), category: 'other' },
      ],
    } : {
      name: 'Fluffy Egg Bhurji with Buttered Toast',
      description: 'Spiced Indian-style scrambled eggs with aromatic herbs on crispy buttered toast',
      prepTime: 8,
      cookTime: 10,
      estimatedCost: Math.min(mealBudget, Math.round(budget * 0.25)),
      difficulty: 'easy',
      steps: [
        { instruction: 'Crack eggs into a bowl, add salt, pepper, and a splash of milk. Whisk until fluffy', duration: 2 },
        { instruction: 'Heat butter in a pan, sauté finely diced onions, tomatoes, and green chillies until soft', duration: 4 },
        { instruction: 'Pour egg mixture over the vegetables, add turmeric and cumin. Gently scramble on medium-low heat', duration: 4 },
        { instruction: 'Toast bread slices with butter until golden', duration: 3 },
        { instruction: 'Garnish eggs with fresh coriander and serve with hot buttered toast', duration: 1 },
      ],
      ingredients: [
        { name: 'Eggs', quantity: `${profile.familySize * 2}`, estimatedCost: Math.round(mealBudget * 0.3), category: 'protein' },
        { name: 'Bread', quantity: `${profile.familySize * 2} slices`, estimatedCost: Math.round(mealBudget * 0.15), category: 'grains' },
        { name: 'Butter', quantity: '2 tbsp', estimatedCost: Math.round(mealBudget * 0.15), category: 'dairy' },
        { name: 'Onion', quantity: '1 medium', estimatedCost: Math.round(mealBudget * 0.08), category: 'vegetables' },
        { name: 'Tomato', quantity: '1 medium', estimatedCost: Math.round(mealBudget * 0.07), category: 'vegetables' },
        { name: 'Green chillies', quantity: '1-2', estimatedCost: Math.round(mealBudget * 0.05), category: 'vegetables' },
        { name: 'Fresh coriander', quantity: 'handful', estimatedCost: Math.round(mealBudget * 0.05), category: 'vegetables' },
      ],
    },

    lunch: isVeg ? {
      name: 'Paneer Butter Masala with Jeera Rice',
      description: 'Rich, creamy tomato-based paneer curry served with fragrant cumin rice',
      prepTime: 15,
      cookTime: 25,
      estimatedCost: Math.min(mealBudget, Math.round(budget * 0.35)),
      difficulty: profile.skillLevel === 'beginner' ? 'medium' : 'easy',
      steps: [
        { instruction: 'Wash and soak basmati rice for 15 minutes. Drain and set aside', duration: 3 },
        { instruction: 'Blanch tomatoes, blend into smooth puree with cashews. Set aside', duration: 5 },
        { instruction: 'Cut paneer into cubes. Lightly pan-fry until golden on each side. Remove and set aside', duration: 5 },
        { instruction: 'In the same pan, add butter, cumin, and ginger-garlic paste. Sauté until fragrant', duration: 3 },
        { instruction: 'Add tomato-cashew puree, turmeric, red chili powder, garam masala. Cook until oil separates', duration: 7 },
        { instruction: 'Meanwhile, cook rice with whole cumin seeds, a bay leaf, and salt until fluffy', duration: 2 },
        { instruction: 'Add cream and fried paneer to the gravy. Simmer for 3-4 minutes. Adjust salt and garnish with fresh coriander and a swirl of cream', duration: 5 },
      ],
      ingredients: [
        { name: 'Paneer', quantity: `${profile.familySize * 100}g`, estimatedCost: Math.round(mealBudget * 0.3), category: 'dairy' },
        { name: 'Basmati rice', quantity: `${profile.familySize} cups`, estimatedCost: Math.round(mealBudget * 0.12), category: 'grains' },
        { name: 'Tomatoes', quantity: '4 medium', estimatedCost: Math.round(mealBudget * 0.08), category: 'vegetables' },
        { name: 'Butter', quantity: '3 tbsp', estimatedCost: Math.round(mealBudget * 0.1), category: 'dairy' },
        { name: 'Fresh cream', quantity: '100ml', estimatedCost: Math.round(mealBudget * 0.1), category: 'dairy' },
        { name: 'Cashews', quantity: '10-12', estimatedCost: Math.round(mealBudget * 0.12), category: 'other' },
        { name: 'Ginger-garlic paste', quantity: '1 tbsp', estimatedCost: Math.round(mealBudget * 0.05), category: 'spices' },
        { name: 'Garam masala', quantity: '1 tsp', estimatedCost: Math.round(mealBudget * 0.03), category: 'spices' },
      ],
    } : {
      name: 'Chicken Biryani (One-Pot)',
      description: 'Aromatic layered rice with tender spiced chicken, caramelized onions, and fresh herbs',
      prepTime: 20,
      cookTime: 35,
      estimatedCost: Math.min(mealBudget, Math.round(budget * 0.35)),
      difficulty: 'medium',
      steps: [
        { instruction: 'Wash and soak basmati rice for 20 minutes. Marinate chicken with yogurt, ginger-garlic paste, turmeric, chili powder, and salt', duration: 5 },
        { instruction: 'Slice onions thinly and fry until deep golden brown (birista). Remove half for garnish', duration: 8 },
        { instruction: 'In the same pot, add marinated chicken over the fried onions. Cook on high heat for 5 minutes', duration: 6 },
        { instruction: 'Par-boil the soaked rice with whole spices (bay leaf, cardamom, cloves, cinnamon) until 70% cooked. Drain', duration: 8 },
        { instruction: 'Layer the par-boiled rice over chicken. Add saffron milk, mint, coriander, and fried onions on top', duration: 4 },
        { instruction: 'Seal the pot with foil + tight lid (dum). Cook on lowest flame for 20 minutes. Do not open', duration: 20 },
        { instruction: 'Gently mix layers, garnish with remaining fried onions and fresh mint. Serve with raita', duration: 3 },
      ],
      ingredients: [
        { name: 'Chicken', quantity: `${profile.familySize * 200}g`, estimatedCost: Math.round(mealBudget * 0.35), category: 'protein' },
        { name: 'Basmati rice', quantity: `${profile.familySize} cups`, estimatedCost: Math.round(mealBudget * 0.12), category: 'grains' },
        { name: 'Onions', quantity: '3 large', estimatedCost: Math.round(mealBudget * 0.08), category: 'vegetables' },
        { name: 'Yogurt', quantity: '1 cup', estimatedCost: Math.round(mealBudget * 0.08), category: 'dairy' },
        { name: 'Ginger-garlic paste', quantity: '2 tbsp', estimatedCost: Math.round(mealBudget * 0.05), category: 'spices' },
        { name: 'Fresh mint', quantity: 'handful', estimatedCost: Math.round(mealBudget * 0.05), category: 'vegetables' },
        { name: 'Saffron', quantity: 'a pinch', estimatedCost: Math.round(mealBudget * 0.1), category: 'spices' },
        { name: 'Biryani masala', quantity: '1 tbsp', estimatedCost: Math.round(mealBudget * 0.05), category: 'spices' },
        { name: 'Oil', quantity: '4 tbsp', estimatedCost: Math.round(mealBudget * 0.05), category: 'other' },
      ],
    },

    dinner: isVeg ? {
      name: 'Dal Tadka with Garlic Naan',
      description: 'Smoky tempered yellow lentils with crispy garlic naan bread',
      prepTime: 10,
      cookTime: 30,
      estimatedCost: Math.min(mealBudget, Math.round(budget * 0.3)),
      difficulty: 'easy',
      steps: [
        { instruction: 'Wash toor dal thoroughly, pressure cook with turmeric, salt, and water for 3-4 whistles', duration: 5 },
        { instruction: 'While dal cooks, prepare naan dough: mix flour, yogurt, baking soda, sugar, and salt. Knead for 5 minutes, rest for 10', duration: 10 },
        { instruction: 'Mash the cooked dal and keep on low heat. Add water to desired consistency', duration: 2 },
        { instruction: 'For tadka: heat ghee, add cumin, mustard seeds, dried red chillies, garlic, and curry leaves. Let them splutter', duration: 3 },
        { instruction: 'Add finely chopped onions and tomatoes to the tadka. Cook until tomatoes soften', duration: 4 },
        { instruction: 'Pour the sizzling tadka over the dal. Add red chili powder and mix. Simmer for 5 minutes', duration: 5 },
        { instruction: 'Roll out naan, brush with garlic butter, and cook on hot tawa until charred spots appear. Brush with more butter', duration: 8 },
        { instruction: 'Garnish dal with fresh coriander and a squeeze of lemon. Serve hot with naan', duration: 2 },
      ],
      ingredients: [
        { name: 'Toor dal', quantity: `${profile.familySize} cups`, estimatedCost: Math.round(mealBudget * 0.15), category: 'protein' },
        { name: 'Wheat flour', quantity: '2 cups', estimatedCost: Math.round(mealBudget * 0.1), category: 'grains' },
        { name: 'Ghee', quantity: '3 tbsp', estimatedCost: Math.round(mealBudget * 0.15), category: 'dairy' },
        { name: 'Garlic', quantity: '6-8 cloves', estimatedCost: Math.round(mealBudget * 0.05), category: 'vegetables' },
        { name: 'Tomatoes', quantity: '2 medium', estimatedCost: Math.round(mealBudget * 0.08), category: 'vegetables' },
        { name: 'Onion', quantity: '1 medium', estimatedCost: Math.round(mealBudget * 0.05), category: 'vegetables' },
        { name: 'Cumin seeds', quantity: '1 tsp', estimatedCost: Math.round(mealBudget * 0.03), category: 'spices' },
        { name: 'Dried red chillies', quantity: '2-3', estimatedCost: Math.round(mealBudget * 0.03), category: 'spices' },
        { name: 'Yogurt', quantity: '2 tbsp', estimatedCost: Math.round(mealBudget * 0.05), category: 'dairy' },
      ],
    } : {
      name: 'Butter Garlic Prawns with Fried Rice',
      description: 'Juicy prawns in a buttery garlic sauce served with quick vegetable fried rice',
      prepTime: 15,
      cookTime: 20,
      estimatedCost: Math.min(mealBudget, Math.round(budget * 0.35)),
      difficulty: 'medium',
      steps: [
        { instruction: 'Clean and devein prawns. Pat dry. Season with salt, pepper, and a pinch of paprika', duration: 5 },
        { instruction: 'Cook rice and spread on a plate to cool. Dice all vegetables (carrots, beans, capsicum) finely', duration: 5 },
        { instruction: 'Heat oil in a wok, scramble an egg. Add vegetables and stir-fry on high heat for 2 minutes', duration: 3 },
        { instruction: 'Add cooled rice, soy sauce, sesame oil, and white pepper. Toss vigorously for 3 minutes', duration: 4 },
        { instruction: 'In a separate pan, melt butter, add sliced garlic, and cook until fragrant and lightly golden', duration: 3 },
        { instruction: 'Add prawns to garlic butter in a single layer. Cook 2 minutes each side until pink and curled', duration: 5 },
        { instruction: 'Squeeze lemon, add chili flakes, toss with fresh parsley. Serve prawns over or alongside fried rice', duration: 2 },
      ],
      ingredients: [
        { name: 'Prawns', quantity: `${profile.familySize * 150}g`, estimatedCost: Math.round(mealBudget * 0.4), category: 'protein' },
        { name: 'Basmati rice', quantity: `${profile.familySize} cups`, estimatedCost: Math.round(mealBudget * 0.1), category: 'grains' },
        { name: 'Butter', quantity: '3 tbsp', estimatedCost: Math.round(mealBudget * 0.1), category: 'dairy' },
        { name: 'Garlic', quantity: '6-8 cloves', estimatedCost: Math.round(mealBudget * 0.05), category: 'vegetables' },
        { name: 'Mixed vegetables', quantity: '1 cup diced', estimatedCost: Math.round(mealBudget * 0.1), category: 'vegetables' },
        { name: 'Soy sauce', quantity: '2 tbsp', estimatedCost: Math.round(mealBudget * 0.05), category: 'other' },
        { name: 'Eggs', quantity: '2', estimatedCost: Math.round(mealBudget * 0.05), category: 'protein' },
        { name: 'Lemon', quantity: '1', estimatedCost: Math.round(mealBudget * 0.03), category: 'fruits' },
      ],
    },

    snack: {
      name: isVeg ? 'Masala Chai with Baked Samosa Bites' : 'Masala Chai with Chicken Tikka Bites',
      description: isVeg ? 'Aromatic spiced tea paired with crispy baked mini samosas' : 'Aromatic spiced tea with smoky grilled chicken tikka cubes',
      prepTime: 10,
      cookTime: 15,
      estimatedCost: Math.min(Math.round(budget * 0.1), Math.round(mealBudget * 0.8)),
      difficulty: 'easy',
      steps: [
        { instruction: 'Boil water with crushed ginger, cardamom, and tea leaves for 3 minutes', duration: 4 },
        { instruction: isVeg ? 'If using frozen samosas, preheat oven/air-fryer to 180°C. Arrange samosas on tray with light oil spray' : 'Marinate chicken cubes with yogurt, tikka masala, lemon juice, and salt', duration: 3 },
        { instruction: 'Add milk and sugar to the chai. Simmer on low for 2-3 minutes until deep brown', duration: 3 },
        { instruction: isVeg ? 'Bake samosas for 12-15 minutes until golden and crispy' : 'Thread onto skewers or spread on a baking tray. Grill or air-fry at 200°C for 10-12 minutes', duration: 12 },
        { instruction: 'Strain chai into cups. Serve hot with the freshly made snack and green chutney', duration: 2 },
      ],
      ingredients: [
        { name: 'Tea leaves', quantity: '2 tsp', estimatedCost: Math.round(budget * 0.01), category: 'other' },
        { name: 'Milk', quantity: '2 cups', estimatedCost: Math.round(budget * 0.02), category: 'dairy' },
        { name: isVeg ? 'Frozen mini samosas' : 'Chicken breast', quantity: isVeg ? '1 packet' : `${profile.familySize * 100}g`, estimatedCost: Math.round(budget * 0.04), category: isVeg ? 'other' : 'protein' },
        { name: 'Ginger', quantity: '1 inch piece', estimatedCost: Math.round(budget * 0.01), category: 'spices' },
        { name: 'Cardamom', quantity: '2 pods', estimatedCost: Math.round(budget * 0.01), category: 'spices' },
      ],
    },
  };

  // Build meals based on mealsPerDay
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'].slice(0, profile.mealsPerDay);
  const meals = mealTypes.map((type, i) => {
    const template = mealTemplates[type];
    return {
      id: `meal-${i}`,
      type,
      ...template,
      servings: profile.familySize,
      steps: template.steps.map((step, j) => ({
        id: `step-${i}-${j}`,
        order: j + 1,
        ...step,
        completed: false,
      })),
      ingredients: template.ingredients.map(ing => ({
        ...ing,
        userHas: profile.availableIngredients.some(
          a => a.toLowerCase().includes(ing.name.toLowerCase()) ||
               ing.name.toLowerCase().includes(a.toLowerCase())
        ),
      })),
    };
  });

  // Build shopping list (exclude items user has)
  const shoppingMap = new Map();
  meals.forEach(meal => {
    meal.ingredients.forEach(ing => {
      if (!ing.userHas && !shoppingMap.has(ing.name)) {
        shoppingMap.set(ing.name, {
          name: ing.name,
          quantity: ing.quantity,
          estimatedCost: ing.estimatedCost,
          category: ing.category,
          purchased: false,
        });
      }
    });
  });

  const totalCost = meals.reduce((s, m) => s + m.estimatedCost, 0);

  return {
    meals,
    shoppingList: Array.from(shoppingMap.values()),
    totalCost,
    totalPrepTime: meals.reduce((s, m) => s + m.prepTime + m.cookTime, 0),
    tips: [
      'Prep all vegetables before you start cooking to save time',
      'Read through all steps before starting a recipe',
      `Today's plan feeds ${profile.familySize} people within your ${currencySymbol}${profile.budget} budget`,
    ],
    generatedAt: new Date().toISOString(),
    currency: profile.currency,
    currencySymbol,
  };
}

// ===== PLAN RENDERING =====
function renderPlan(plan, profile) {
  const currencySymbol = plan.currencySymbol || CURRENCY_SYMBOLS[profile?.currency] || '₹';

  // Update greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.querySelector('.plan-greeting h2').innerHTML =
    `${greeting}, <span id="plan-user-name">${profile?.name || 'there'}</span>! 👋`;

  // Update summary cards
  document.getElementById('summary-meals').textContent = plan.meals.length;
  document.getElementById('summary-time').textContent = `${plan.totalPrepTime} min`;
  document.getElementById('summary-cost').textContent = `${currencySymbol}${plan.totalCost}`;
  document.getElementById('summary-items').textContent = plan.shoppingList.filter(i => !i.purchased).length;

  // Render meals tab
  renderMeals(plan, currencySymbol);

  // Render shopping tab
  renderShoppingList(plan, currencySymbol);

  // Render timeline tab
  renderTimeline(plan, currencySymbol, profile);

  // Update progress
  updateProgress();
}

function renderMeals(plan, currencySymbol) {
  const container = document.getElementById('content-meals');
  container.innerHTML = plan.meals.map((meal, i) => `
    <div class="meal-card" id="card-${meal.id}" style="animation-delay: ${i * 0.1}s">
      <div class="meal-card-header" onclick="toggleMealCard('${meal.id}')">
        <div class="meal-card-left">
          <div class="meal-type-badge ${meal.type}">
            ${MEAL_EMOJIS[meal.type] || '🍽️'}
          </div>
          <div class="meal-info">
            <h3>${escapeHtml(meal.name)}</h3>
            <div class="meal-meta">
              <span>⏱️ ${meal.prepTime + meal.cookTime} min</span>
              <span>💰 ${currencySymbol}${meal.estimatedCost}</span>
              <span>📊 ${capitalize(meal.difficulty)}</span>
            </div>
          </div>
        </div>
        <svg class="meal-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="meal-card-body">
        ${meal.description ? `<p class="text-muted" style="margin-bottom: var(--space-4); font-size: var(--font-size-sm);">${escapeHtml(meal.description)}</p>` : ''}
        <div class="ingredients-mini">
          ${meal.ingredients.map(ing => `
            <span class="ingredient-tag ${ing.userHas ? 'has' : ''}">
              ${ing.userHas ? '✓' : ''} ${escapeHtml(ing.name)} · ${escapeHtml(ing.quantity)}
            </span>
          `).join('')}
        </div>
        <div class="steps-label">Cooking Steps</div>
        ${meal.steps.map(step => `
          <div class="cooking-step ${step.completed ? 'completed' : ''}"
               id="el-${step.id}"
               onclick="toggleStep('${meal.id}', '${step.id}')">
            <div class="step-checkbox">${step.completed ? '✓' : ''}</div>
            <div class="step-content">
              <div class="step-text">${escapeHtml(step.instruction)}</div>
              <div class="step-duration">⏱️ ${step.duration} min</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  // Show tips if available
  if (plan.tips && plan.tips.length > 0) {
    container.innerHTML += `
      <div class="meal-card" style="animation-delay: ${plan.meals.length * 0.1}s; border-color: var(--accent-secondary-soft);">
        <div class="meal-card-header" style="cursor: default;">
          <div class="meal-card-left">
            <div class="meal-type-badge" style="background: var(--accent-secondary-soft);">💡</div>
            <div class="meal-info">
              <h3>Pro Tips</h3>
              <div class="meal-meta"><span>Quick tips for a smooth cooking day</span></div>
            </div>
          </div>
        </div>
        <div class="meal-card-body" style="display: block;">
          ${plan.tips.map(tip => `
            <div class="cooking-step" style="cursor: default;">
              <div class="step-checkbox" style="border-color: var(--accent-secondary); color: var(--accent-secondary);">✦</div>
              <div class="step-content">
                <div class="step-text">${escapeHtml(tip)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
}

function renderShoppingList(plan, currencySymbol) {
  const container = document.getElementById('content-shopping');

  // Group by category
  const categories = {};
  plan.shoppingList.forEach(item => {
    const cat = item.category || 'other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(item);
  });

  const categoryLabels = {
    vegetables: '🥬 Vegetables',
    fruits: '🍎 Fruits',
    dairy: '🧈 Dairy',
    grains: '🌾 Grains & Cereals',
    protein: '🥩 Protein',
    spices: '🌶️ Spices & Seasonings',
    other: '📦 Other Items',
  };

  const totalShoppingCost = plan.shoppingList.reduce((s, i) => s + (i.estimatedCost || 0), 0);

  container.innerHTML = Object.entries(categories).map(([cat, items]) => `
    <div class="shopping-section">
      <div class="shopping-section-title">${categoryLabels[cat] || categoryLabels.other}</div>
      ${items.map((item, i) => `
        <div class="shopping-item ${item.purchased ? 'purchased' : ''}"
             id="shop-${encodeId(item.name)}"
             onclick="toggleShoppingItem('${escapeAttr(item.name)}')">
          <div class="shop-checkbox">${item.purchased ? '✓' : ''}</div>
          <div class="shop-info">
            <span class="shop-name">${escapeHtml(item.name)}</span>
            <span class="shop-qty">${escapeHtml(item.quantity)}</span>
          </div>
          <span class="shop-cost">${currencySymbol}${item.estimatedCost}</span>
        </div>
      `).join('')}
    </div>
  `).join('') + `
    <div class="shopping-total">
      <span class="shopping-total-label">Estimated Shopping Total</span>
      <span class="shopping-total-value">${currencySymbol}${totalShoppingCost}</span>
    </div>
  `;
}

function renderTimeline(plan, currencySymbol, profile) {
  const container = document.getElementById('content-timeline');

  // Parse schedule to assign times
  const schedule = profile?.cookingTimeWindow || 'Morning 7-9 AM, Afternoon 12-1 PM, Evening 7-9 PM';
  const timeSlots = parseScheduleToTimes(schedule, plan.meals.length);

  container.innerHTML = `
    <div class="timeline">
      ${plan.meals.map((meal, i) => `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-time">${timeSlots[i] || `Meal ${i + 1}`}</div>
          <div class="timeline-content">
            <div class="timeline-meal-name">${MEAL_EMOJIS[meal.type] || '🍽️'} ${escapeHtml(meal.name)}</div>
            <div class="timeline-duration">
              ⏱️ ${meal.prepTime} min prep + ${meal.cookTime} min cook · 💰 ${currencySymbol}${meal.estimatedCost}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function parseScheduleToTimes(schedule, count) {
  // Simple parsing of schedule string
  const defaults = ['7:00 AM — Breakfast', '12:30 PM — Lunch', '7:30 PM — Dinner', '4:00 PM — Snack'];
  const parts = schedule.split(',').map(s => s.trim());

  return Array.from({ length: count }, (_, i) => {
    if (parts[i]) {
      return parts[i];
    }
    return defaults[i] || `Meal ${i + 1}`;
  });
}

// ===== INTERACTIVE FEATURES =====
function toggleMealCard(mealId) {
  const card = document.getElementById(`card-${mealId}`);
  if (card) card.classList.toggle('expanded');
}

function toggleStep(mealId, stepId) {
  if (!currentPlan) return;

  const meal = currentPlan.meals.find(m => m.id === mealId);
  if (!meal) return;

  const step = meal.steps.find(s => s.id === stepId);
  if (!step) return;

  step.completed = !step.completed;

  // Update UI
  const el = document.getElementById(`el-${stepId}`);
  if (el) {
    el.classList.toggle('completed', step.completed);
    const checkbox = el.querySelector('.step-checkbox');
    if (checkbox) checkbox.textContent = step.completed ? '✓' : '';
  }

  // Save and update progress
  localStorage.setItem(STORAGE_KEYS.plan, JSON.stringify(currentPlan));
  updateProgress();
}

function toggleShoppingItem(itemName) {
  if (!currentPlan) return;

  const item = currentPlan.shoppingList.find(i => i.name === itemName);
  if (!item) return;

  item.purchased = !item.purchased;

  // Update UI
  const el = document.getElementById(`shop-${encodeId(itemName)}`);
  if (el) {
    el.classList.toggle('purchased', item.purchased);
    const checkbox = el.querySelector('.shop-checkbox');
    if (checkbox) checkbox.textContent = item.purchased ? '✓' : '';
  }

  // Update summary
  const remaining = currentPlan.shoppingList.filter(i => !i.purchased).length;
  document.getElementById('summary-items').textContent = remaining;

  // Save
  localStorage.setItem(STORAGE_KEYS.plan, JSON.stringify(currentPlan));
}

function updateProgress() {
  if (!currentPlan) return;

  const allSteps = currentPlan.meals.flatMap(m => m.steps);
  const completed = allSteps.filter(s => s.completed).length;
  const total = allSteps.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  document.getElementById('progress-text').textContent = `${completed} of ${total} steps done`;
  document.getElementById('progress-percent').textContent = `${percent}%`;
  document.getElementById('progress-fill').style.width = `${percent}%`;
}

// ===== TAB MANAGEMENT =====
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`content-${tabName}`).classList.add('active');
}

// ===== UTILITY FUNCTIONS =====
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function encodeId(str) {
  return (str || '').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
