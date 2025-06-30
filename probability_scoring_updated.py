import random
import numpy as np
from collections import defaultdict
from tqdm import tqdm
import pprint

# --- 1. GAME & SIMULATION CONFIG (Statistical Approach) ---

KC_TO_METRICS_MAPPING = {
    'KC2':  ['Revenue', 'Reputation'], 'KC3':  ['CustomerSatisfaction', 'Revenue'], 'KC4':  ['Revenue'],
    'KC5':  ['Reputation', 'CustomerSatisfaction'], 'KC6':  ['Revenue'],
    'KC7':  ['Revenue', 'CustomerSatisfaction', 'Reputation'], 'KC10': ['CustomerSatisfaction', 'Revenue', 'Reputation'],
    'KC11': ['Reputation', 'CustomerSatisfaction', 'Revenue'], 'KC11a':['Reputation', 'CustomerSatisfaction', 'Revenue'],
    'KC13': ['Reputation', 'EthicalDecisionMaking', 'CustomerSatisfaction'], 'KC14': ['Revenue', 'RiskTaking'],
    'KC16': ['RiskTaking', 'Revenue', 'EthicalDecisionMaking'], 'KC18': ['EthicalDecisionMaking', 'Reputation', 'CustomerSatisfaction'],
    'KC19': ['Revenue', 'RiskTaking', 'CustomerSatisfaction'], 'KC20': ['Reputation', 'Revenue', 'CustomerSatisfaction'],
}
ALL_KCS = list(KC_TO_METRICS_MAPPING.keys())
METRICS = ["Revenue", "CustomerSatisfaction", "Reputation", "EthicalDecisionMaking", "RiskTaking"]

# --- Designer's Input: Define plausible ranges for the search ---
# The GA will search for values within these bounds.
# We've expanded the ranges based on the results of the first run.
WEIGHT_RANGES = {
    "Revenue":                (100, 1500), # Increased max
    "CustomerSatisfaction":   (10, 100),   # Increased max
    "Reputation":             (0.5, 10),   # Increased max significantly
    "EthicalDecisionMaking":  (1, 20),     # Increased max
    "RiskTaking":             (1, 20),     # Increased max
}
GOAL_RANGES = {
    "Revenue":                (2000, 15000), # Lowered min, increased max
    "CustomerSatisfaction":   (50, 600),     # Lowered min, increased max
    "Reputation":             (5, 100),      # Lowered min, increased max
    "EthicalDecisionMaking":  (5, 60),       # Increased max
    "RiskTaking":             (5, 60),       # Increased max
}

# --- 2. PRE-COMPUTATION: SIMULATE KC ACQUISITION ---

def generate_simulated_payload():
    """
    Generates a random decision payload based on a more realistic statistical model.
    A triangular distribution makes positive outcomes more likely than negative ones.
    """
    payload = []
    # A decision payload can affect 1, 2, or 3 KCs
    num_kcs_in_payload = random.choices([1, 2, 3], weights=[0.4, 0.5, 0.1], k=1)[0]
    kcs_for_this_payload = random.sample(ALL_KCS, num_kcs_in_payload)
    
    for kc in kcs_for_this_payload:
        # NEW: Use a triangular distribution.
        # It takes (left_bound, right_bound, mode), where mode is the most likely value.
        # This simulates a player who is generally trying to succeed (mode > 0).
        score = np.random.triangular(left=-1.0, right=1.0, mode=0.6)
        payload.append({"score": round(score, 2), "kc_identifier": kc})
        
    return payload

def precompute_player_kc_journeys(num_players, num_chapters=3, decisions_per_chapter=3):
    """
    Simulates player journeys to get their cumulative KC scores at the end of each chapter.
    This is the key optimization. We do this only once.
    Returns a list of dictionaries, where each dict is a player's journey.
    """
    print(f"Pre-computing KC acquisition for {num_players} players...")
    
    # Generate a universe of possible choices
    possible_payloads = [generate_simulated_payload() for _ in range(500)]
    
    player_journeys = []
    for _ in tqdm(range(num_players)):
        cumulative_kc_scores = defaultdict(float)
        # Stores the KC totals at the end of each chapter: [{'KC2': 0.5}, {'KC2': 1.1}, ...]
        kc_totals_by_chapter = []
        
        for _ in range(num_chapters):
            for _ in range(decisions_per_chapter):
                payload = random.choice(possible_payloads)
                for item in payload:
                    cumulative_kc_scores[item['kc_identifier']] += item['score']
            kc_totals_by_chapter.append(dict(cumulative_kc_scores))
        player_journeys.append(kc_totals_by_chapter)
        
    print("Pre-computation complete.")
    return player_journeys

# --- 3. THE GENETIC ALGORITHM ENGINE ---

def create_random_individual(metric_name):
    """Creates a single 'Individual' (a full solution of weights and a goal)."""
    individual = {
        'weights': {},
        'goal': random.uniform(*GOAL_RANGES[metric_name])
    }
    # Find all KCs that affect this metric
    kcs_for_metric = [kc for kc, metrics in KC_TO_METRICS_MAPPING.items() if metric_name in metrics]
    
    # Assign a random weight to each relevant KC
    weight_min, weight_max = WEIGHT_RANGES[metric_name]
    for kc in kcs_for_metric:
        individual['weights'][kc] = random.uniform(weight_min, weight_max)
        
    return individual

def calculate_fitness(individual, metric_name, player_journeys):
    """
    The Fitness Function. Calculates how well an individual's parameters meet the targets.
    Lower error = higher fitness.
    """
    num_players = len(player_journeys)
    target_win_pct = np.array([0.0, 0.65, 0.85]) # [Chap1, Chap2, Chap3]
    
    goal = individual['goal']
    weights = individual['weights']
    
    # Calculate metric scores for all players using this individual's weights
    # This loop is the performance bottleneck, so it's kept as efficient as possible.
    final_scores_per_chapter = np.zeros((num_players, 3))
    
    for i, journey in enumerate(player_journeys):
        for chapter_idx in range(3):
            chapter_kc_totals = journey[chapter_idx]
            metric_score = 0
            for kc, score in chapter_kc_totals.items():
                if kc in weights:
                    metric_score += score * weights[kc]
            final_scores_per_chapter[i, chapter_idx] = metric_score

    # Check for wins
    has_won_by_chapter = final_scores_per_chapter >= goal
    
    wins_c1 = np.sum(has_won_by_chapter[:, 0])
    wins_c2 = np.sum(has_won_by_chapter[:, 1])
    wins_c3 = np.sum(has_won_by_chapter[:, 2])
    
    actual_win_pct = np.array([wins_c1, wins_c2, wins_c3]) / num_players
    
    # Calculate error (Sum of Squared Errors), heavily penalizing early winners
    error = (
        ((actual_win_pct[0] - target_win_pct[0]) * 5)**2 + # Heavy penalty for C1 winners
        (actual_win_pct[1] - target_win_pct[1])**2 +
        (actual_win_pct[2] - target_win_pct[2])**2
    )
    
    return error, actual_win_pct

def crossover(parent1, parent2):
    """Combines two parents to create a child."""
    child = {'weights': {}, 'goal': 0}
    
    # Crossover for goal (averaging)
    child['goal'] = (parent1['goal'] + parent2['goal']) / 2.0
    
    # Crossover for weights
    all_weights_keys = set(parent1['weights'].keys()) | set(parent2['weights'].keys())
    for key in all_weights_keys:
        # Average the weights from both parents
        child['weights'][key] = (parent1['weights'][key] + parent2['weights'][key]) / 2.0
        
    return child

def mutate(individual, metric_name, mutation_rate, mutation_strength):
    """Randomly tweaks an individual's genes."""
    # Mutate goal
    if random.random() < mutation_rate:
        tweak = random.uniform(-mutation_strength, mutation_strength) * (GOAL_RANGES[metric_name][1] - GOAL_RANGES[metric_name][0])
        individual['goal'] += tweak
        # Clamp to bounds
        individual['goal'] = max(GOAL_RANGES[metric_name][0], min(individual['goal'], GOAL_RANGES[metric_name][1]))

    # Mutate weights
    weight_min, weight_max = WEIGHT_RANGES[metric_name]
    for kc in individual['weights']:
        if random.random() < mutation_rate:
            tweak = random.uniform(-mutation_strength, mutation_strength) * (weight_max - weight_min)
            individual['weights'][kc] += tweak
            # Clamp to bounds
            individual['weights'][kc] = max(weight_min, min(individual['weights'][kc], weight_max))
    return individual

def run_genetic_algorithm_for_metric(metric_name, player_journeys):
    """Main GA loop to find the best parameters for a single metric."""
    
    # --- GA Hyperparameters ---
    POPULATION_SIZE = 100
    GENERATIONS = 50
    MUTATION_RATE = 0.1
    MUTATION_STRENGTH = 0.2 # How big the mutation jump is
    ELITISM_COUNT = 5 # Keep the top 5 individuals unchanged
    
    print(f"\n--- Running GA for '{metric_name}' ---")
    
    # 1. Create initial population
    population = [create_random_individual(metric_name) for _ in range(POPULATION_SIZE)]
    
    best_overall_individual = None
    best_overall_fitness = float('inf')

    for gen in tqdm(range(GENERATIONS), desc=f"Evolving {metric_name}"):
        # 2. Evaluate fitness of the population
        fitness_scores = [calculate_fitness(ind, metric_name, player_journeys) for ind in population]
        # Pair individuals with their fitness scores for sorting
        pop_with_fitness = sorted(zip([f[0] for f in fitness_scores], population), key=lambda x: x[0])
        
        # Check for new best solution
        if pop_with_fitness[0][0] < best_overall_fitness:
            best_overall_fitness = pop_with_fitness[0][0]
            best_overall_individual = pop_with_fitness[0][1]

        # 3. Selection and creating the new generation
        new_population = []
        
        # Elitism: carry over the best individuals
        elites = [ind for fitness, ind in pop_with_fitness[:ELITISM_COUNT]]
        new_population.extend(elites)
        
        # Select parents from the top 50% of the population
        potential_parents = [ind for fitness, ind in pop_with_fitness[:POPULATION_SIZE // 2]]
        
        # 4. Crossover & 5. Mutation
        while len(new_population) < POPULATION_SIZE:
            parent1, parent2 = random.sample(potential_parents, 2)
            child = crossover(parent1, parent2)
            child = mutate(child, metric_name, MUTATION_RATE, MUTATION_STRENGTH)
            new_population.append(child)
            
        population = new_population

    # Final evaluation of the best individual found
    final_fitness, final_win_pct = calculate_fitness(best_overall_individual, metric_name, player_journeys)
    
    return best_overall_individual, final_fitness, final_win_pct

# --- 4. MAIN EXECUTION ---
if __name__ == "__main__":
    NUM_PLAYERS_TO_SIMULATE = 2000 # More is better, but slower
    
    # Step 1: Pre-compute all player KC acquisition journeys
    player_kc_data = precompute_player_kc_journeys(NUM_PLAYERS_TO_SIMULATE)
    
    # Step 2: Run the GA for each metric to learn its parameters
    final_results = {}
    for metric in METRICS:
        best_ind, best_fit, win_pct = run_genetic_algorithm_for_metric(metric, player_kc_data)
        final_results[metric] = {
            "solution": best_ind,
            "fitness_error": best_fit,
            "win_percentages": win_pct
        }

    # Step 3: Print the final report
    print("\n\n" + "="*70)
    print("      LEARNED GAME BALANCE PARAMETERS VIA GENETIC ALGORITHM      ")
    print("="*70)
    print("Target Win % by end of Chap 1/2/3: [0.0%, 65.0%, 85.0%]\n")

    for metric, result in final_results.items():
        print(f"--- {metric} ---")
        sol = result['solution']
        print(f"  Learned Win-Condition Goal: {sol['goal']:.2f}")
        print("  Learned KC Weights:")
        # Sort weights for consistent display
        sorted_weights = sorted(sol['weights'].items(), key=lambda item: item[0])
        for kc, weight in sorted_weights:
            print(f"    - {kc}: {weight:.2f}")
        print(f"\n  Resulting Win % by end of Chap 1/2/3: "
              f"[{result['win_percentages'][0]*100:.1f}%, "
              f"{result['win_percentages'][1]*100:.1f}%, "
              f"{result['win_percentages'][2]*100:.1f}%]")
        print(f"  Final Error Score: {result['fitness_error']:.5f}")
        print("-"*70) 