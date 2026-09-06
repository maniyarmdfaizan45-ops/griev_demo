import csv
import random
import re
from difflib import SequenceMatcher

CATEGORIES = ["Water", "Electricity", "Road", "Garbage", "Others"]
TARGET_PER_CATEGORY = 120

# Curated examples use different sentence structures and levels of detail.
# Water covers supply and drinking-water quality; Road covers carriageways,
# pavements, potholes, and road safety; Others covers unrelated civic issues,
# including non-road drainage complaints.
EXAMPLES = {
    "Water": [
        "Our taps have been dry since Monday morning.",
        "There has been no municipal water in our lane for four days.",
        "Water arrives after midnight, when most families are asleep.",
        "The supply schedule changes every day without any notice.",
        "Pressure is too weak to fill the rooftop tank.",
        "The public tap near the market is broken and leaking.",
        "A pipe burst outside house 18 and water is running down the street.",
        "Clean drinking water is not reaching the apartments in Block C.",
        "The tanker booked for our colony did not arrive today.",
        "Please restore the water connection to our neighbourhood.",
        "Brown water came from the kitchen tap this morning.",
        "The supplied water smells of sewage and cannot be used for cooking.",
        "Residents are finding mud and sand in the drinking water.",
        "Chlorine levels in the tap water seem unusually high.",
        "Our building receives water for only ten minutes a day.",
        "The overhead tank is not filling even though the main line is open.",
        "Water is being wasted from a leaking valve beside the bus stop.",
        "A broken water main has flooded the entrance to our homes.",
        "The new houses on this street still have no water connection.",
        "We were not informed about the sudden water shutdown.",
        "Can someone check the low pressure in the north wing?",
        "The tap water tastes metallic and leaves a white residue.",
        "Water supply has stopped since last night after pipeline work.",
        "Our hand pump is dry although nearby streets have regular supply.",
        "The tanker water promised for the school did not turn up.",
        "A cracked pipe is spraying water near the community centre.",
        "No water is coming to the upper floors of our building.",
        "The supply is muddy after every rainfall.",
        "Please repair the leaking public standpost in Ward 7.",
        "There is a foul taste in the water distributed this week.",
    ],
    "Electricity": [
        "Power has been out in our block since dawn.",
        "The street lights on Lake Road do not switch on at night.",
        "Voltage keeps jumping and damaged my refrigerator.",
        "A transformer is making sparks beside the school wall.",
        "There are repeated power cuts every evening.",
        "An electric wire is hanging across the footpath.",
        "Our electricity bill shows a meter reading that is not ours.",
        "The pole near the park is leaning dangerously.",
        "The new extension still has no street lighting.",
        "Power returned for five minutes and failed again.",
        "The meter runs even when every appliance is switched off.",
        "A live cable is touching the branches outside our house.",
        "The transformer near Gate 2 is buzzing loudly.",
        "Load shedding was not announced to residents.",
        "Street lamps have been dark for a week.",
        "The electricity line flickers whenever it rains.",
        "Please fix the broken light outside the clinic.",
        "Our area has had no power for 15 hours after the storm.",
        "The utility pole is blocking the entrance after it fell.",
        "There is a burning smell from the roadside junction box.",
        "My bill doubled despite using less electricity this month.",
        "The transformer oil appears to be leaking onto the road.",
        "Power cuts are making the lift unusable in our building.",
        "The street light near the crossing is broken.",
        "A wire has fallen into the school playground.",
        "The meter display is blank but electricity is still connected.",
        "High voltage damaged two fans in our home.",
        "The whole lane goes dark after sunset.",
        "Please send a crew to the sparking pole on Main Street.",
        "Our connection trips whenever the water pump starts.",
    ],
    "Road": [
        "Deep potholes have formed across the lane.",
        "The pavement outside the hospital is broken.",
        "Rain leaves a large pool on the road near the junction.",
        "An open manhole is directly in the carriageway.",
        "The road surface has peeled away and is full of loose gravel.",
        "A broken divider is forcing vehicles into the wrong lane.",
        "Road work stopped three months ago and the street remains dug up.",
        "Children need a speed breaker near the school entrance.",
        "The footpath has collapsed beside the main road.",
        "Potholes are causing accidents for two-wheelers after dark.",
        "Mud from unfinished construction makes the road slippery.",
        "There is no safe crossing at the busy market road.",
        "The lane has become impassable after recent rain.",
        "Heavy vehicles have damaged the surface outside our colony.",
        "The newly repaired road is already cracking.",
        "Please repair the broken kerb near the bus stop.",
        "The road marking has disappeared at the sharp bend.",
        "Water is collecting in potholes along Hill View Road.",
        "The unfinished bridge approach has no warning signs.",
        "A fallen tree is blocking one side of the road.",
        "The pavement is uneven and difficult for wheelchair users.",
        "Loose stones from the road repair are hitting passing vehicles.",
        "A large crack runs across the entire street.",
        "The traffic island was damaged in an accident and needs rebuilding.",
        "Open manholes have been left without barricades.",
        "The road to the clinic becomes muddy with light rain.",
        "Please fill the pothole outside house 42.",
        "The asphalt has washed away near the culvert.",
        "Vehicles cannot pass because construction material covers the lane.",
        "A missing guardrail makes the bend unsafe.",
    ],
    "Garbage": [
        "The collection truck has skipped our street for a week.",
        "Bins outside the market are overflowing.",
        "A pile of waste is rotting beside the public park.",
        "People are dumping plastic in the empty plot.",
        "The garbage heap smells terrible in the afternoon heat.",
        "Wet and dry waste are being mixed in the same truck.",
        "The community bins are missing and residents are littering.",
        "Mosquitoes are breeding around the uncollected waste.",
        "Sanitation workers left sweepings in front of our gate.",
        "Medical waste has been thrown with household rubbish.",
        "The dustbin near the bus stop has no lid.",
        "Our lane has not received door-to-door collection.",
        "Stray animals are tearing open the garbage bags.",
        "The market waste is not removed before morning.",
        "Please clear the dump behind the community hall.",
        "There is broken glass mixed into the roadside rubbish.",
        "The public bin is overflowing onto the footpath.",
        "No separate bins are provided for food and plastic waste.",
        "Garbage is being burned near the apartments.",
        "The waste truck comes irregularly and leaves half the bins full.",
        "A foul smell from the dump is entering our homes.",
        "Litter has covered the playground after the weekend.",
        "Please collect the bags left outside the clinic.",
        "The open dump is attracting flies and rats.",
        "Construction rubbish has been dumped beside the park.",
        "Our street cleaners have not visited since Friday.",
        "There is no bin near the railway footbridge.",
        "The garbage container is leaking dirty liquid.",
        "Plastic waste is blocking the entrance to the market.",
        "Household waste is being thrown into the storm drain.",
    ],
    "Others": [
        "Stray dogs are chasing children near the park.",
        "Loud music from the wedding hall continues past midnight.",
        "The public toilet has no running water and is unhygienic.",
        "Mosquitoes are increasing around the stagnant drain behind our homes.",
        "Unlicensed food stalls are blocking the school entrance.",
        "Illegal posters have covered the walls of the public building.",
        "A broken street sign makes it difficult to find the clinic.",
        "The park grass is overgrown and the benches are damaged.",
        "Commercial trucks are parked across our colony entrance.",
        "A dead animal has been left beside the public toilet.",
        "The open drain behind the houses is clogged with silt.",
        "Sewage is overflowing from the drain into the courtyard.",
        "The community hall is being used for noisy events every night.",
        "Someone has dumped building debris in the public garden.",
        "The playground lights and swings are both broken.",
        "A swarm of mosquitoes is coming from the stagnant open drain.",
        "Street vendors have taken over the footpath near the school.",
        "The public toilet has not been cleaned for many days.",
        "Stray cattle are wandering through the residential lane.",
        "A damaged signboard is hanging over the footpath.",
        "The park gate is broken and cannot be secured at night.",
        "Late-night noise from the banquet hall is disturbing residents.",
        "The open drain is overflowing, but the road itself is intact.",
        "A vacant plot has become a shelter for nuisance animals.",
        "Illegal parking blocks the entrance to the fire station.",
        "The public urinal has a severe smell and no lights.",
        "Posters and paint have defaced the bus shelter.",
        "The community playground is being used for drinking at night.",
        "A broken bench is dangerous in the public park.",
        "The drain cover behind our building is missing.",
        "Street vendors are selling food without hygiene precautions.",
    ],
}

# Each category has 18 different sentence structures and five distinct contexts.
# The combinations add coverage without cloning a small set of sentences.
VARIATIONS = {
    "Water": {
        "contexts": [
            {"place": "Shanti Nagar", "time": "since Tuesday", "impact": "families on the upper floors"},
            {"place": "the market lane", "time": "for three mornings", "impact": "the nearby food stalls"},
            {"place": "Block C", "time": "after yesterday's pipeline work", "impact": "the hostel residents"},
            {"place": "Ward 7", "time": "throughout this week", "impact": "elderly people in the colony"},
            {"place": "the bus-stand neighbourhood", "time": "since the weekend", "impact": "shops and homes along the lane"},
        ],
        "templates": [
            "No water has reached {place} {time}; {impact} are carrying buckets from far away.",
            "Can the water department explain why supply to {place} stops {time}?",
            "The tap runs for a few minutes at {place}, which is not enough for {impact}.",
            "Please send someone to inspect the municipal line serving {place}.",
            "Water comes at an odd hour in {place}, and many residents miss it.",
            "The pressure is so low in {place} that the overhead tank stays empty.",
            "A leaking water pipe is wasting a steady stream beside {place}.",
            "People in {place} are receiving cloudy water {time}.",
            "The water smells strange around {place}; {impact} are afraid to drink it.",
            "We booked a tanker for {place}, but it has not arrived {time}.",
            "The public standpost at {place} is broken again.",
            "Pls restore the connection in {place}; there has been no supply {time}.",
            "The repaired pipeline near {place} is leaking at its joint.",
            "Residents of {place} have to store water because delivery is unreliable.",
            "A muddy flow came from taps in {place} after the rain.",
            "Could you test the drinking water supplied to {place}?",
            "Our building in {place} gets water only once a day, sometimes not at all.",
            "The water board gave no notice before cutting supply to {place}.",
        ],
    },
    "Electricity": {
        "contexts": [
            {"place": "MG Road", "time": "since last night", "impact": "shops using refrigerated goods"},
            {"place": "the school crossing", "time": "for nearly a week", "impact": "children walking home"},
            {"place": "Sunset Colony", "time": "every evening", "impact": "people working from home"},
            {"place": "the old market", "time": "after the storm", "impact": "several apartment buildings"},
            {"place": "Green Valley", "time": "for two billing cycles", "impact": "small shop owners"},
        ],
        "templates": [
            "There has been no power in {place} {time}, and {impact} cannot operate normally.",
            "The street lights in {place} are not working, leaving {impact} without safe lighting.",
            "A transformer near {place} is sparking and making a loud buzzing sound.",
            "Please replace the damaged electric pole beside {place}.",
            "Voltage in {place} rises and falls enough to restart every appliance.",
            "An exposed wire is hanging low across the path at {place}.",
            "The street lamps in {place} remain off after sunset.",
            "Power was restored briefly in {place}, then failed again.",
            "The meter reading for our house in {place} is clearly incorrect.",
            "Residents of {place} have reported frequent cuts {time}.",
            "A fallen cable is lying near {place}; please make it safe before someone is hurt.",
            "The pole-mounted light at {place} has stopped working, pls repair it.",
            "A burning smell is coming from the distribution box at {place}.",
            "The electricity supply to {place} trips whenever the pump starts.",
            "Our bill shows a reading that does not match the meter in {place}.",
            "High voltage in {place} damaged a television and two fans.",
            "The new homes near {place} still have no power connection.",
            "Can the utility crew check the crackling overhead line at {place}?",
        ],
    },
    "Road": {
        "contexts": [
            {"place": "the primary school gate", "time": "after the recent rain", "impact": "school buses and bicycles"},
            {"place": "Airport Road junction", "time": "for more than a month", "impact": "two-wheelers in the morning"},
            {"place": "the clinic approach", "time": "since the cable work", "impact": "wheelchairs and ambulances"},
            {"place": "Station Road", "time": "during every shower", "impact": "pedestrians and auto drivers"},
            {"place": "the railway crossing", "time": "after heavy trucks used it", "impact": "vehicles entering the town"},
        ],
        "templates": [
            "Several potholes have appeared near {place}, making it hard for {impact} to pass.",
            "The road surface at {place} has broken down {time}.",
            "Please repair the damaged carriageway outside {place}; it is unsafe.",
            "A deep pothole at {place} is filling with water and hiding its depth.",
            "The pavement beside {place} has cracked and pedestrians are walking in traffic.",
            "Construction left a trench across the road near {place} with no warning sign.",
            "Loose stones from the repair work at {place} are hitting passing vehicles.",
            "The divider at {place} is broken and drivers are entering the wrong lane.",
            "Road damage near {place} is causing delays and minor falls.",
            "The road becomes slippery around {place} {time}; please resurface it.",
            "An open manhole beside {place} needs a cover and barricades immediately.",
            "The footpath at {place} has collapsed, so people are forced onto the road.",
            "Pls fill the potholes at {place} before another motorbike crashes.",
            "Rainwater collects in a broad depression outside {place}.",
            "The asphalt near {place} is peeling away in long strips.",
            "A missing guardrail makes the bend at {place} dangerous at night.",
            "The road crew abandoned the excavation near {place} and left rubble behind.",
            "Could the council repaint the faded crossing and lane marks at {place}?",
        ],
    },
    "Garbage": {
        "contexts": [
            {"place": "the vegetable market", "time": "since Monday", "impact": "nearby shopkeepers"},
            {"place": "the community park", "time": "for five days", "impact": "children and morning walkers"},
            {"place": "the bus shelter", "time": "after the weekend", "impact": "commuters waiting there"},
            {"place": "our apartment entrance", "time": "for the past fortnight", "impact": "residents carrying groceries"},
            {"place": "the empty plot behind the clinic", "time": "in the hot weather", "impact": "patients and staff"},
        ],
        "templates": [
            "The collection truck has missed {place} {time}; {impact} are dealing with a growing pile.",
            "Bins at {place} are overflowing and nobody has emptied them.",
            "Waste has been dumped beside {place}, attracting flies and stray animals.",
            "Please arrange a pickup from {place} before the smell gets worse.",
            "People are throwing household rubbish around {place} because there is no covered bin.",
            "The garbage contractor visits {place} irregularly and leaves half the waste behind.",
            "Food waste at {place} is leaking onto the footpath.",
            "Plastic and paper are mixed with wet waste near {place}.",
            "A pile of rubbish has blocked the walkway at {place}.",
            "The waste truck passed {place} without stopping {time}.",
            "Medical and household waste are being thrown together near {place}.",
            "Pls clear the stinking dump beside {place}; it is affecting {impact}.",
            "The bin enclosure at {place} is damaged, so bags are scattered everywhere.",
            "Residents of {place} need regular door-to-door garbage collection.",
            "Burning waste near {place} is filling the area with smoke.",
            "There are no separate containers for recyclable waste at {place}.",
            "The sanitation team left sweepings in front of {place} after cleaning.",
            "Could the ward office remove the accumulated rubbish from {place}?",
        ],
    },
    "Others": {
        "contexts": [
            {"place": "the public garden", "time": "for several nights", "impact": "families living nearby"},
            {"place": "the school entrance", "time": "during the morning rush", "impact": "children and parents"},
            {"place": "the bus stand", "time": "since the festival", "impact": "daily passengers"},
            {"place": "the open drain behind our homes", "time": "after each rainfall", "impact": "people in the ground-floor houses"},
            {"place": "the colony gate", "time": "every evening", "impact": "fire and delivery vehicles"},
        ],
        "templates": [
            "Stray dogs near {place} are frightening {impact} {time}.",
            "Loud music from the hall beside {place} continues late into the night.",
            "The public toilet at {place} is dirty, has no soap, and needs attention.",
            "Mosquitoes are breeding in the stagnant drain near {place}.",
            "Unlicensed vendors have taken over the footpath at {place}.",
            "Illegal posters have covered the wall around {place}.",
            "The park equipment at {place} is broken and unsafe for children.",
            "Commercial vehicles parked at {place} are blocking the entrance.",
            "Sewage from the open drain at {place} is overflowing into nearby courtyards.",
            "A damaged signboard at {place} is hanging dangerously over pedestrians.",
            "The public facility at {place} has not been cleaned for several days.",
            "Pls remove the abandoned furniture dumped near {place}.",
            "The playground at {place} is being used for drinking after dark.",
            "A dead animal has been left beside {place} and is causing a bad smell.",
            "The drain behind {place} is clogged with weeds and silt.",
            "Street vendors at {place} are selling food without basic hygiene.",
            "The park gate at {place} cannot be locked at night.",
            "Could the council address the nuisance at {place} before {impact} are affected further?",
        ],
    },
}


def normalize_text(text):
    """Normalize formatting without changing the citizen's wording."""
    return re.sub(r"\s+", " ", text.strip()).casefold()


def validate_dataset(rows):
    seen = {}
    normalized_texts = []
    for row in rows:
        text = row["complaint_text"]
        category = row["category"]
        if not text or not category:
            raise ValueError("Dataset contains a missing complaint or category")
        key = normalize_text(text)
        if key in seen and seen[key] != category:
            raise ValueError(f"Contradictory labels for complaint: {text}")
        if key in seen:
            raise ValueError(f"Duplicate complaint text: {text}")
        if any(SequenceMatcher(None, key, previous).ratio() >= 0.96 for previous in normalized_texts):
            raise ValueError(f"Suspiciously similar complaint text: {text}")
        seen[key] = category
        normalized_texts.append(key)


def build_candidates(category):
    variation = VARIATIONS[category]
    generated = [
        template.format(**context)
        for template in variation["templates"]
        for context in variation["contexts"]
    ]
    candidates = EXAMPLES[category][:] + generated
    if len(candidates) < TARGET_PER_CATEGORY:
        raise ValueError(f"Not enough candidates for category: {category}")
    return candidates


def generate_dataset(file_path, seed=42):
    randomizer = random.Random(seed)
    rows = []
    for category in CATEGORIES:
        candidates = build_candidates(category)
        randomizer.shuffle(candidates)
        rows.extend(
            {"complaint_text": text, "category": category}
            for text in candidates[:TARGET_PER_CATEGORY]
        )

    randomizer.shuffle(rows)
    validate_dataset(rows)
    with open(file_path, "w", newline="", encoding="utf-8") as dataset_file:
        writer = csv.DictWriter(dataset_file, fieldnames=["complaint_text", "category"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"Dataset generated successfully with {len(rows)} unique samples at {file_path}")


if __name__ == "__main__":
    generate_dataset("dataset.csv")
