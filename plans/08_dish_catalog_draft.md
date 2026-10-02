# Khaozo — Dish Catalog (DRAFT for review)

> Status: **DRAFT — Claude drafted, waiting for Sangram's review** (Phase 1 prerequisite, `06_phase_plan.md`)
> Last updated: 2 Oct 2026
> Feeds: migration `002` (cuisines, dish categories, main ingredients, tags — must-have rows) and `seeds/seed.sql` (standard dishes + aliases)
> Rules from `03_data_modelling.md`: category = dish **type** only · cuisine sits on the **standard dish** · one optional **main ingredient** per dish (used for "foods to avoid") · diet = `veg` / `egg` / `non_veg` (own column) · aliases are lowercase and each alias points to **exactly one** dish

**How to review:** strike out / edit / add rows directly. Things I was unsure about are marked **❓**.

---

## 1. Cuisines (migration 002)
From the plan: Odia · North Indian · South Indian · Mughlai · Chinese · Continental · Street food · Bakery & desserts
**Proposed additions ❓:** Fast food (burgers, pizza, sandwiches — currently no good home) · Beverages (tea, coffee, lassi, shakes)

## 2. Main ingredients (migration 002)
From the plan: Chicken · Mutton · Fish · Prawn · Egg · Paneer · Mushroom
**Proposed additions ❓:** Crab · Pork (served at some Chinese / North-East places) · Chhena (cottage cheese — avoided by some people with dairy issues)

## 3. Tags (migration 002 — fixed by the plan, no changes)
- mood: Work · Study · Date · Family · Friends · Solo · Quick bite · Late night · Celebration · Budget
- meal_time: Breakfast · Lunch · Evening snacks · Dinner · Late night

## 4. Dish categories (migration 002)
From the plan: Biryani · Momos · Dosa · Rolls · Thali · Chhena sweets
**Proposed additions:** Rice & Pulao · Curry · Veg curry · Dal · Breads · Idli & Vada · South Indian tiffin · Noodles · Fried rice · Chinese starters · Soup · Chaat · Fritters & snacks · Kebab & Tandoori · Fry · Pitha · Sweets · Pizza · Burger · Sandwich · Pasta · Cakes & pastries · Drinks

---

## 5. Standard dishes + aliases (seed.sql)

### Biryani
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Chicken Dum Biryani | Mughlai | Chicken | non_veg | chicken biryani, chkn biryani, chicken biriyani, dum biryani |
| Mutton Biryani | Mughlai | Mutton | non_veg | mutton biriyani, mutton dum biryani |
| Egg Biryani | Mughlai | Egg | egg | anda biryani, egg biriyani |
| Veg Biryani | Mughlai | – | veg | vegetable biryani, veg biriyani |
| Paneer Biryani | Mughlai | Paneer | veg | paneer biriyani |
| Prawn Biryani | Mughlai | Prawn | non_veg | chingudi biryani, prawn biriyani |
| Fish Biryani | Mughlai | Fish | non_veg | machha biryani |
| Mushroom Biryani | Mughlai | Mushroom | veg | – |

### Rice & Pulao
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Pakhala Bhata | Odia | – | veg | pakhala, pakhal, panta bhata |
| Jeera Rice | North Indian | – | veg | jira rice |
| Veg Pulao | North Indian | – | veg | veg pulav, pulao |
| Plain Rice | North Indian | – | veg | steamed rice, bhata ❓ |
| Curd Rice | South Indian | – | veg | dahi bhata ❓ |

### Thali
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Odia Veg Thali | Odia | – | veg | odia thali, odia meals |
| Odia Fish Thali | Odia | Fish | non_veg | machha thali |
| North Indian Veg Thali | North Indian | – | veg | veg thali |
| South Indian Meals | South Indian | – | veg | south indian thali, meals |
| Chicken Thali | North Indian | Chicken | non_veg | – |
| Mutton Thali | Odia ❓ | Mutton | non_veg | mansa thali |

### Curry (non-veg / egg)
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Butter Chicken | North Indian | Chicken | non_veg | murgh makhani, chicken makhani |
| Chicken Kasa | Odia | Chicken | non_veg | chicken kosha, kukuda kasa |
| Chicken Curry | North Indian | Chicken | non_veg | kukuda tarkari |
| Kadai Chicken | North Indian | Chicken | non_veg | chicken kadai, karahi chicken |
| Chicken Tikka Masala | North Indian | Chicken | non_veg | – |
| Mutton Kasa | Odia | Mutton | non_veg | mutton kosha, mansa kasa |
| Mutton Curry | Odia | Mutton | non_veg | mansa tarkari, mangsa tarkari |
| Mutton Rogan Josh | North Indian | Mutton | non_veg | rogan josh |
| Machha Besara | Odia | Fish | non_veg | fish besara, macha besara |
| Machha Jhola | Odia | Fish | non_veg | fish jhol, macha jhola |
| Fish Curry | Odia | Fish | non_veg | machha tarkari |
| Chingudi Malai Curry | Odia | Prawn | non_veg | prawn malai curry, chingri malai curry |
| Prawn Curry | Odia | Prawn | non_veg | chingudi tarkari |
| Crab Curry | Odia | Crab ❓ | non_veg | kankada tarkari |
| Egg Curry | Odia | Egg | egg | anda tarkari, egg tarkari |

### Veg curry
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Dalma | Odia | – | veg | – |
| Santula | Odia | – | veg | – |
| Chhena Tarkari | Odia | Chhena ❓ | veg | chhena curry |
| Aloo Potala Rasa | Odia | – | veg | potala rasa, parwal curry |
| Paneer Butter Masala | North Indian | Paneer | veg | pbm, paneer makhani |
| Kadai Paneer | North Indian | Paneer | veg | paneer kadai |
| Palak Paneer | North Indian | Paneer | veg | – |
| Shahi Paneer | Mughlai | Paneer | veg | – |
| Matar Paneer | North Indian | Paneer | veg | mutter paneer |
| Mushroom Masala | North Indian | Mushroom | veg | – |
| Mix Veg | North Indian | – | veg | mixed vegetable |
| Chana Masala | North Indian | – | veg | chole |
| Aloo Dum | Odia | – | veg | aloodum, alu dum |
| Malai Kofta | North Indian | – | veg | – |

### Dal
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Dal Fry | North Indian | – | veg | – |
| Dal Tadka | North Indian | – | veg | dal tarka |
| Dal Makhani | North Indian | – | veg | – |

### Breads
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Butter Naan | North Indian | – | veg | naan |
| Garlic Naan | North Indian | – | veg | – |
| Tandoori Roti | North Indian | – | veg | tandoor roti |
| Lachha Paratha | North Indian | – | veg | laccha paratha |
| Aloo Paratha | North Indian | – | veg | alu paratha |
| Puri Sabji | North Indian | – | veg | puri bhaji, poori sabzi |

### Dosa
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Masala Dosa | South Indian | – | veg | masala dosha |
| Plain Dosa | South Indian | – | veg | sada dosa |
| Onion Dosa | South Indian | – | veg | – |
| Rava Dosa | South Indian | – | veg | rawa dosa |
| Mysore Masala Dosa | South Indian | – | veg | mysore dosa |
| Paneer Dosa | South Indian | Paneer | veg | – |
| Egg Dosa | South Indian | Egg | egg | – |

### Idli & Vada
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Idli Sambar | South Indian | – | veg | idli, idly |
| Medu Vada | South Indian | – | veg | vada sambar, wada |

### South Indian tiffin
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Upma | South Indian | – | veg | uppuma |
| Uttapam | South Indian | – | veg | uthappam |

### Momos
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Chicken Steamed Momos | Chinese | Chicken | non_veg | chicken momos, chicken momo |
| Chicken Fried Momos | Chinese | Chicken | non_veg | fried chicken momos |
| Veg Steamed Momos | Chinese | – | veg | veg momos, veg momo |
| Veg Fried Momos | Chinese | – | veg | fried veg momos |
| Paneer Momos | Chinese | Paneer | veg | paneer momo |
| Chicken Tandoori Momos | Chinese | Chicken | non_veg | tandoori momos |
| Pork Momos | Chinese | Pork ❓ | non_veg | – |

### Noodles
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Veg Chowmein | Chinese | – | veg | veg noodles, veg hakka noodles |
| Chicken Chowmein | Chinese | Chicken | non_veg | chicken noodles, chicken hakka noodles |
| Egg Chowmein | Chinese | Egg | egg | egg noodles |
| Schezwan Noodles | Chinese | – | veg | szechuan noodles |

### Fried rice
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Veg Fried Rice | Chinese | – | veg | – |
| Chicken Fried Rice | Chinese | Chicken | non_veg | – |
| Egg Fried Rice | Chinese | Egg | egg | – |
| Mixed Fried Rice | Chinese | Chicken ❓ | non_veg | mix fried rice |

### Chinese starters
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Chilli Chicken | Chinese | Chicken | non_veg | chili chicken |
| Chicken Lollipop | Chinese | Chicken | non_veg | lollipop |
| Chicken Manchurian | Chinese | Chicken | non_veg | – |
| Veg Manchurian | Chinese | – | veg | gobi manchurian ❓ |
| Chilli Paneer | Chinese | Paneer | veg | chili paneer |
| Chilli Mushroom | Chinese | Mushroom | veg | – |
| Honey Chilli Potato | Chinese | – | veg | – |
| Chilli Fish | Chinese | Fish | non_veg | – |

### Soup
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Veg Manchow Soup | Chinese | – | veg | manchow soup |
| Chicken Manchow Soup | Chinese | Chicken | non_veg | – |
| Hot and Sour Soup | Chinese | – | veg | hot n sour soup |
| Sweet Corn Soup | Chinese | – | veg | – |
| Tomato Soup | Continental | – | veg | – |

### Rolls
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Egg Roll | Street food | Egg | egg | anda roll |
| Chicken Roll | Street food | Chicken | non_veg | – |
| Egg Chicken Roll | Street food | Chicken | non_veg | chicken egg roll |
| Paneer Roll | Street food | Paneer | veg | – |
| Veg Roll | Street food | – | veg | – |
| Mutton Roll | Street food | Mutton | non_veg | – |

### Chaat
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Dahibara Aloodum | Street food | – | veg | dahibara, dahi bara aloo dum, dahi vada aloo dum |
| Gupchup | Street food | – | veg | pani puri, golgappa, puchka |
| Chaat | Street food | – | veg | ❓ (too generic? maybe "Matar Chaat") |
| Bhel Puri | Street food | – | veg | bhel |
| Papdi Chaat | Street food | – | veg | – |
| Aloo Tikki Chaat | Street food | – | veg | tikki chaat |

### Fritters & snacks
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Bara Ghugni | Odia | – | veg | bara ghuguni, vada ghugni |
| Ghugni | Odia | – | veg | ghuguni |
| Aloo Chop | Odia | – | veg | alu chop |
| Piaji | Odia | – | veg | onion pakoda ❓ |
| Samosa | Street food | – | veg | singada |
| Mudhi Mansa | Odia | Mutton | non_veg | mudi mansa |
| Egg Chop | Street food | Egg | egg | dimer chop |
| Chicken Pakoda | Street food | Chicken | non_veg | chicken pakora |
| Paneer Pakoda | Street food | Paneer | veg | paneer pakora |
| Pav Bhaji | Street food | – | veg | – |
| Vada Pav | Street food | – | veg | wada pav |

### Kebab & Tandoori
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Tandoori Chicken | Mughlai | Chicken | non_veg | – |
| Chicken Tikka | Mughlai | Chicken | non_veg | – |
| Chicken Seekh Kebab | Mughlai | Chicken | non_veg | – |
| Mutton Seekh Kebab | Mughlai | Mutton | non_veg | seekh kebab |
| Reshmi Kebab | Mughlai | Chicken | non_veg | chicken reshmi kebab |
| Paneer Tikka | Mughlai | Paneer | veg | – |
| Afghani Chicken | Mughlai | Chicken | non_veg | – |

### Fry
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Fish Fry | Odia | Fish | non_veg | machha bhaja |
| Prawn Fry | Odia | Prawn | non_veg | chingudi bhaja |
| Crab Fry | Odia | Crab ❓ | non_veg | kankada bhaja |
| Chicken Fry | North Indian | Chicken | non_veg | – |
| Egg Omelette | Street food | Egg | egg | omelette, omlet |

### Pitha
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Chakuli Pitha | Odia | – | veg | chakuli |
| Arisa Pitha | Odia | – | veg | arisa |
| Manda Pitha | Odia | – | veg | manda |
| Enduri Pitha | Odia | – | veg | enduri |
| Kakara Pitha | Odia | – | veg | kakara |
| Poda Pitha | Odia | – | veg | – |

### Chhena sweets
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Chhena Poda | Odia | Chhena ❓ | veg | chenna poda, chena poda |
| Rasagola | Odia | Chhena ❓ | veg | rasgulla, rosogolla, rasagolla |
| Rasabali | Odia | Chhena ❓ | veg | – |
| Chhena Gaja | Odia | Chhena ❓ | veg | chenna gaja |
| Chhena Jhili | Odia | Chhena ❓ | veg | chenna jhili |
| Chhena Murki | Odia | Chhena ❓ | veg | – |
| Rasmalai | Bakery & desserts | Chhena ❓ | veg | ras malai |
| Sandesh | Bakery & desserts | Chhena ❓ | veg | sondesh |

### Sweets
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Khira Sagara | Odia | – | veg | – |
| Khaja | Odia | – | veg | – |
| Gulab Jamun | Bakery & desserts | – | veg | gulabjamun |
| Kheer | North Indian | – | veg | payasa, khiri |
| Jalebi | Street food | – | veg | jilebi |
| Gajar Halwa | North Indian | – | veg | gajar ka halwa |
| Malpua | Odia ❓ | – | veg | – |

### Pizza ❓ (cuisine: Fast food if added, else Continental)
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Margherita Pizza | Continental | – | veg | margarita pizza |
| Paneer Tikka Pizza | Continental | Paneer | veg | – |
| Chicken Pizza | Continental | Chicken | non_veg | – |
| Farmhouse Pizza | Continental | – | veg | – |

### Burger
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Veg Burger | Continental | – | veg | aloo tikki burger |
| Chicken Burger | Continental | Chicken | non_veg | – |
| Paneer Burger | Continental | Paneer | veg | – |

### Sandwich
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Veg Grilled Sandwich | Continental | – | veg | grilled sandwich, veg sandwich |
| Chicken Sandwich | Continental | Chicken | non_veg | – |
| Club Sandwich | Continental | Chicken ❓ | non_veg | – |

### Pasta
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| White Sauce Pasta | Continental | – | veg | alfredo pasta |
| Red Sauce Pasta | Continental | – | veg | arrabiata pasta, arrabbiata pasta |
| Chicken Pasta | Continental | Chicken | non_veg | – |

### Cakes & pastries
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Chocolate Pastry | Bakery & desserts | – | egg ❓ | choco pastry |
| Black Forest Pastry | Bakery & desserts | – | egg ❓ | black forest |
| Brownie | Bakery & desserts | – | egg ❓ | chocolate brownie |
| Cheesecake | Bakery & desserts | – | egg ❓ | – |

### Drinks ❓ (cuisine: Beverages if added)
| Dish | Cuisine | Main ingredient | Diet | Aliases |
|---|---|---|---|---|
| Masala Chai | Street food | – | veg | chai, cha, tea |
| Cold Coffee | Continental | – | veg | – |
| Filter Coffee | South Indian | – | veg | – |
| Lassi | North Indian | – | veg | sweet lassi |
| Mango Shake | Continental | – | veg | – |
| Fresh Lime Soda | Continental | – | veg | lime soda |

---

## Open questions for review
1. Add cuisines **Fast food** and **Beverages**? (Pizza/burger/drinks otherwise sit under Continental / Street food.)
2. Add main ingredients **Crab**, **Pork**, **Chhena**? If Chhena is not added, the Chhena-sweet rows get "–".
3. Cakes/pastries: `egg` by default, or `veg` (eggless is common in Bhubaneswar bakeries)? Bakeries can add eggless variants as menu items either way.
4. "Chaat" (generic) — keep as its own dish or drop?
5. Missing local favourites? (Specific Bhubaneswar dishes you want rated at launch.)
