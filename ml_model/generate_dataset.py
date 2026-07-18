import csv
import random

# Define categories
categories = ["Water", "Electricity", "Road", "Garbage", "Others"]

# Base templates for complaints in each category
templates = {
    "Water": [
        "No water supply in our locality since last {days} days.",
        "The drinking water supplied today is muddy, dirty and has a foul smell.",
        "Main water pipeline leaked near house {num} on {street} street, wasting thousands of liters.",
        "Water pressure is extremely low in {street} area, making it impossible to store water.",
        "Water supply timings are highly irregular. Sometimes it comes at midnight.",
        "Public water tap is broken and leaking continuously in the local market.",
        "Sewage water is mixing with the drinking water line in our building.",
        "Water tankers are not arriving on schedule despite pre-booking.",
        "Municipal water supply is cut off without any prior notice or announcement.",
        "High chlorine levels detected in municipal tap water in {street}."
    ],
    "Electricity": [
        "Frequent power outages and unscheduled load shedding occurring in {street}.",
        "High voltage fluctuations today damaged our television and refrigerator.",
        "Street lights on {street} road are not functioning at night, causing dark zones and safety hazards.",
        "The electric transformer near {street} park is sparking and making loud buzzing noises.",
        "We received a double electricity bill this month with incorrect reading readings.",
        "A live electrical wire is hanging dangerously low near the school gate on {street}.",
        "Our area has been in total darkness for {days} hours after the rainstorm.",
        "Electric poles are leaning dangerously and might fall anytime on cars.",
        "Electricity meter is running excessively fast even when mains are switched off.",
        "No street lights are installed in the new extension area of {street}."
    ],
    "Road": [
        "Huge potholes on {street} road are causing multiple minor accidents and traffic jams.",
        "Road construction work started 3 months ago but is now completely abandoned.",
        "Waterlogging on {street} after a light rain because of poor road slope and design.",
        "Speed breakers are desperately needed near the children's park on {street}.",
        "Road pavement is completely broken and uneven, making walking difficult for senior citizens.",
        "Gravel and mud from unfinished road work makes {street} road very slippery for two-wheelers.",
        "Encroachment on the main road by vendors is blocking traffic during peak hours.",
        "Manholes on the road are left open without any warning signs or barricades.",
        "The road surface has peeled off completely, generating high amounts of dust in the air.",
        "Road divider is broken near {street} junction, leading to wrong-way driving."
    ],
    "Garbage": [
        "Garbage collection truck has not visited {street} for the last {days} days.",
        "A huge pile of stinking garbage has accumulated on the corner of {street}.",
        "Public dustbins in {street} market are overflowing and attracting stray animals.",
        "People are dumping plastic bottles and household waste in the open park.",
        "Stagnant garbage pile is breeding flies, mosquitoes, and causing health hazards.",
        "The neighborhood sanitary workers are dumping sweepings in front of our main gate.",
        "E-waste and medical garbage are being mixed with domestic waste on the street.",
        "Lack of trash cans in the community park is causing visitors to litter everywhere.",
        "Foul smell from the open garbage dump on {street} is making it hard to breathe.",
        "No separate bins are provided for wet and dry waste segregation in our ward."
    ],
    "Others": [
        "Stray dogs are roaming in packs on {street} and chasing kids and two-wheelers.",
        "High noise levels from the wedding hall speakers late at night on {street}.",
        "Drainage blockage has caused sewage water to overflow on the footpath.",
        "Public park on {street} is poorly maintained, grass is overgrown and lights are broken.",
        "Illegal parking of commercial trucks is blocking the entrance to our colony.",
        "The public toilet facility near {street} bus stand is extremely dirty and lacks running water.",
        "Mosquito menace has increased exponentially due to stagnant water in open drains.",
        "Unlicensed street vendors are selling unhygienic food items near the school area.",
        "Public playground is being used by anti-social elements for drinking alcohol in the evening.",
        "Defaced public walls with illegal posters and spray paint on {street}."
    ]
}

# Modifiers to generate variety
streets = [
    "Gandhi Road", "Link Road", "Station Road", "Green Valley Street", "Park Avenue", 
    "Temple Street", "High Street", "Market Lane", "Church Road", "Baker Street",
    "Outer Ring Road", "Airport Road", "Hill View Road", "Sunset Boulevard", "MG Road"
]
days_list = ["3", "4", "5", "7", "10", "15"]
nums = ["12", "45A", "78", "102", "234", "9", "56B", "189"]

def generate_dataset(file_path):
    dataset = []
    
    # Target size is 250+ samples
    # We will loop through templates and generate multiple unique versions using modifiers
    random.seed(42)  # For reproducibility
    
    # 1. Base generation from templates
    for category, temp_list in templates.items():
        # Generate several variations for each template
        for temp in temp_list:
            for _ in range(6):  # Create 6 variations per template
                days = random.choice(days_list)
                street = random.choice(streets)
                num = random.choice(nums)
                
                complaint = temp.format(days=days, street=street, num=num)
                dataset.append({"complaint_text": complaint, "category": category})
                
    # 2. Add some more short & specific phrases to increase diversity
    extra_samples = [
        # Water
        ("No water supply since morning.", "Water"),
        ("Water pipe burst near my house.", "Water"),
        ("Dirty water coming from tap.", "Water"),
        ("Low water pressure in supply.", "Water"),
        ("Water tank is leaking.", "Water"),
        # Electricity
        ("Power cut since 2 hours.", "Electricity"),
        ("Voltage fluctuation is high.", "Electricity"),
        ("Street light not working.", "Electricity"),
        ("Transformer blast in my area.", "Electricity"),
        ("Flickering electricity line.", "Electricity"),
        # Road
        ("Road pothole needs repair.", "Road"),
        ("Potholes are very dangerous on highway.", "Road"),
        ("Road construction is pending.", "Road"),
        ("Water logging on main road.", "Road"),
        ("Open manhole on the street.", "Road"),
        # Garbage
        ("Garbage dump is overflowing.", "Garbage"),
        ("Trash truck not coming.", "Garbage"),
        ("Foul smell from public bin.", "Garbage"),
        ("Clean the waste on roadside.", "Garbage"),
        ("Littering in the park.", "Garbage"),
        # Others
        ("Stray dog threat in locality.", "Others"),
        ("Loud music at midnight.", "Others"),
        ("Blocked drain is overflowing.", "Others"),
        ("Mosquitoes breeding in open drain.", "Others"),
        ("Public park is in bad shape.", "Others")
    ]
    
    for text, cat in extra_samples:
        dataset.append({"complaint_text": text, "category": cat})

    # Shuffle dataset
    random.shuffle(dataset)
    
    # Write to CSV
    with open(file_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["complaint_text", "category"])
        writer.writeheader()
        writer.writerows(dataset)
        
    print(f"Dataset generated successfully with {len(dataset)} samples at {file_path}")

if __name__ == "__main__":
    generate_dataset("dataset.csv")
