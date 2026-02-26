/**
 * Hydration and sodium loss calculator
 * Models sweat rate based on body weight, temperature, humidity, and intensity
 */

export interface HydrationTarget {
  fluidMlPerHour: number;
  sodiumMgPerHour: number;
  totalFluidLiters: number;
  totalSodiumMg: number;
  sweatRateLPerHour: number;
  rationale: string;
}

export interface HydrationInput {
  bodyWeightKg: number;
  durationHours: number;
  temperatureCelsius: number;
  humidity: number;                    // 0-100%
  intensityPercent: number;            // % of FTP
  sweatRate: 'light' | 'moderate' | 'heavy';
}

/**
 * Estimate sweat rate (L/hr) based on conditions
 * Based on Baker (2017) sweat rate models
 */
function estimateSweatRate(input: HydrationInput): number {
  const { bodyWeightKg, temperatureCelsius, humidity, intensityPercent, sweatRate } = input;

  // Base sweat rate per kg body weight (L/hr/kg)
  const baseRatePerKg =
    sweatRate === 'light'    ? 0.008 :
    sweatRate === 'moderate' ? 0.012 :
                               0.018;

  let rate = baseRatePerKg * bodyWeightKg;

  // Temperature adjustment (sweat rate increases ~10-15% per 5°C above 20°C)
  if (temperatureCelsius > 20) {
    const tempFactor = 1 + ((temperatureCelsius - 20) / 5) * 0.12;
    rate *= tempFactor;
  } else if (temperatureCelsius < 10) {
    rate *= 0.7; // cooler = less sweating
  }

  // Humidity adjustment (higher humidity = higher perceived sweat but similar loss)
  if (humidity > 60) {
    rate *= 1 + ((humidity - 60) / 100) * 0.15;
  }

  // Intensity adjustment
  const intensity = Math.max(0.5, Math.min(1.0, intensityPercent));
  rate *= 0.6 + (intensity * 0.4);

  return Math.round(rate * 100) / 100;
}

export function calculateHydration(input: HydrationInput): HydrationTarget {
  const sweatRateLPerHour = estimateSweatRate(input);

  // Replace 80-100% of sweat losses (don't over-hydrate)
  const fluidMlPerHour = Math.round(sweatRateLPerHour * 1000 * 0.85);

  // Sodium concentration in sweat: 20-80 mmol/L, average ~40-50 mmol/L
  // 1 mmol Na = 23mg
  const sodiumConcentration =
    input.sweatRate === 'light'    ? 35 :
    input.sweatRate === 'moderate' ? 45 :
                                     60; // mmol/L

  const sodiumMgPerLiter = sodiumConcentration * 23;
  const sodiumMgPerHour = Math.round(sweatRateLPerHour * sodiumMgPerLiter);

  const totalFluidLiters = Math.round(sweatRateLPerHour * input.durationHours * 0.85 * 10) / 10;
  const totalSodiumMg = Math.round(sodiumMgPerHour * input.durationHours);

  let rationale = `Estimated sweat rate: ${sweatRateLPerHour}L/hr`;
  if (input.temperatureCelsius > 30) {
    rationale += ' (hot conditions — prioritize pre-cooling and hydration)';
  } else if (input.temperatureCelsius < 10) {
    rationale += ' (cool conditions — thirst may underestimate needs)';
  }

  return {
    fluidMlPerHour,
    sodiumMgPerHour,
    totalFluidLiters,
    totalSodiumMg,
    sweatRateLPerHour,
    rationale,
  };
}
