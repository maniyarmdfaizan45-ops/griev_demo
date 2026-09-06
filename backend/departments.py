DEPARTMENT_BY_CATEGORY = {
    "Water": "Water Supply Department",
    "Electricity": "Electricity Department",
    "Road": "Public Works Department",
    "Garbage": "Sanitation/Waste Management Department",
    "Others": "General/Public Grievance Department",
}

DEPARTMENTS = tuple(DEPARTMENT_BY_CATEGORY.values())


def get_department_for_category(category):
    return DEPARTMENT_BY_CATEGORY.get(category, DEPARTMENT_BY_CATEGORY["Others"])
