-- FBA FC base data and weekly appointment status for the hot FC dashboard.
-- Run this complete file in Supabase SQL Editor. Seed inserts are split into small chunks and deduplicated by FC.

create table if not exists public.fba_fcs (
  fc text primary key,
  zip text,
  state text,
  address text,
  city text,
  transit_days numeric,
  legal_transit_hours numeric,
  remark text,
  latitude numeric,
  longitude numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fba_fcs
add column if not exists legal_transit_hours numeric;

create table if not exists public.fc_weekly_appointments (
  fc text not null references public.fba_fcs(fc) on delete cascade,
  week_start date not null,
  appointment_status text check (
    appointment_status in ('Normal', 'Slightly Busy', 'Very Busy', 'Severely Full')
    or appointment_status is null
  ),
  updated_at timestamptz not null default now(),
  primary key (fc, week_start)
);

create table if not exists public.fba_fc_route_cache (
  origin_key text not null,
  fc text not null references public.fba_fcs(fc) on delete cascade,
  origin_address text not null,
  destination_address text,
  destination_latitude numeric,
  destination_longitude numeric,
  distance_meters integer,
  distance_miles numeric,
  duration_seconds integer,
  duration_minutes numeric,
  duration_text text,
  routing_preference text,
  route_description text,
  encoded_polyline text,
  coordinate_count integer,
  generated_at timestamptz not null,
  primary key (origin_key, fc)
);

alter table public.fc_weekly_appointments
drop constraint if exists fc_weekly_appointments_appointment_status_check;

alter table public.fc_weekly_appointments
add constraint fc_weekly_appointments_appointment_status_check
check (
  appointment_status in ('Normal', 'Slightly Busy', 'Very Busy', 'Severely Full')
  or appointment_status is null
);

create index if not exists fc_weekly_appointments_week_idx on public.fc_weekly_appointments (week_start);
create index if not exists fba_fcs_state_idx on public.fba_fcs (state);
create index if not exists fba_fc_route_cache_fc_idx on public.fba_fc_route_cache (fc);

alter table public.fba_fcs enable row level security;
alter table public.fc_weekly_appointments enable row level security;
alter table public.fba_fc_route_cache enable row level security;

drop policy if exists "personal anon read fba_fcs" on public.fba_fcs;
drop policy if exists "personal anon write fba_fcs" on public.fba_fcs;
create policy "personal anon read fba_fcs" on public.fba_fcs for select to anon using (true);
create policy "personal anon write fba_fcs" on public.fba_fcs for all to anon using (true) with check (true);

drop policy if exists "personal anon read fc_weekly_appointments" on public.fc_weekly_appointments;
drop policy if exists "personal anon write fc_weekly_appointments" on public.fc_weekly_appointments;
create policy "personal anon read fc_weekly_appointments" on public.fc_weekly_appointments for select to anon using (true);
create policy "personal anon write fc_weekly_appointments" on public.fc_weekly_appointments for all to anon using (true) with check (true);

drop policy if exists "personal anon read fba_fc_route_cache" on public.fba_fc_route_cache;
drop policy if exists "personal anon write fba_fc_route_cache" on public.fba_fc_route_cache;
create policy "personal anon read fba_fc_route_cache" on public.fba_fc_route_cache for select to anon using (true);
create policy "personal anon write fba_fc_route_cache" on public.fba_fc_route_cache for all to anon using (true) with check (true);

-- FC seed chunk 1
insert into public.fba_fcs (fc, zip, state, address, city, transit_days, remark, latitude, longitude) values
  ('ABE3', '18031', 'PA', '650 Boulder Drive', 'Breinigsville', 4.5, null, 41.06722, -77.99485),
  ('ABE4', '18045', 'PA', '1610 Van Buren Road,', 'Easton', 4.5, null, 40.07899, -76.86387),
  ('ABE8', '08518', 'NJ', '401 Independence Road', 'Florence', 4.5, null, 41.06479, -75.67944),
  ('ABQ2', '87031', 'NM', '6251 Pioneer Trail NW', 'LOS LUNAS', 1.5, null, 34.39934, -106.14417),
  ('ACY2', '08016', 'NJ', '1101 E PEARL ST', 'BURLINGTON', 4.5, null, 39.81537, -74.54846),
  ('AKR1', '44705', 'OH', '4747 Rebar Ave NE', 'CANTON', 3.5, null, 40.89349, -83.92335),
  ('ALB1', '12033', 'NY', '1835 US Route 9', 'Castleton', 5.0, null, 42.09867, -75.62335),
  ('AMA1', '79108', 'TX', '8590 NE 24th Avenue', 'AMARILLO', 3.0, null, 30.70508, -97.61287),
  ('ATL1', '30349', 'GA', '6055 S Fulton Pkwy,Atlanta,GA,30349,US', 'Atlanta', 4.0, null, 33.82062, -84.04386),
  ('AVP1', '18202', 'PA', '550 Oak Ridge Road', 'Hazle Township', 4.5, null, 39.89546, -76.27093),
  ('AVP2', '18434', 'PA', '298 1st Ave,', 'Gouldsboro', 4.5, null, 41.32134, -76.53446),
  ('AVP3', '18424', 'PA', '298 1ST AVE', 'GOULDSBORO', 4.5, null, 39.69781, -77.11642),
  ('AVP8', '18640', 'PA', '250 Enterprise Way', 'Pittston', 4.5, null, 40.82016, -77.6325),
  ('AVP9', '18434', 'PA', '45 VALLEY VIEW DR', 'JESSUP', 4.5, null, 40.38958, -76.16113),
  ('AZA4', '85043', 'AZ', '3333 S 59TH AVE', 'PHOENIX', 1.0, null, 33.85329, -110.69004),
  ('BDL6', '06416', 'CT', '120 County Line Drive', 'CROMWELL', 5.0, null, 42.29308, -73.90282),
  ('BFI3', '98327', 'WA', '2700 Center Drive Pierce County', 'Dupont', 2.5, null, 46.74796, -120.47481),
  ('BFI7', '98390', 'WA', '1901 140th Ave E', 'Sumner', 2.5, null, 47.50325, -120.56265),
  ('BFI9', '98327', 'WA', '3230 INTERNATIONAL PL', 'DUPONT', 2.5, null, 46.5009, -121.8254),
  ('BFL2', '93263', 'CA', '4500 EXPRESS AVE', 'SHAFTER', 0.12, null, 35.53385, -120.08235),
  ('BNA2', '37090', 'TN', '500 Duke DR', 'LEBANON', 3.5, null, 36.10432, -86.79666),
  ('BNA3', '37127', 'TN', '2020 JOE B JACKSON PKWY', 'Murfreesboro', 3.5, null, 36.22432, -87.26882),
  ('BNA6', '37040', 'TN', '3875 GUTHRIE HWY', 'Clarksville', 3.5, null, 35.56079, -85.72058),
  ('BOS7', '02720', 'MA', '1180 Innovation Way', 'Fall River', 5.0, null, 41.70429, -72.58971),
  ('BWI1', '20166', 'VA', '45121 Global Plaza', 'Sterling', 4.5, null, 37.40581, -79.53703),
  ('BWI4', '22624', 'VA', '165 Business Blvd', 'Clear Brook', 4.5, null, 38.6411, -77.92291),
  ('CHA2', '37310', 'TN', '225 Infinity Dr NW', 'Charleston', 3.5, null, 35.52549, -87.13705),
  ('CHO1', '22939', 'VA', 'TRADER RD 32', 'FISHERSVILLE', 4.5, null, 38.26698, -78.21938),
  ('CLT2', '28214', 'NC', '10240 Old Dowd Rd,', 'Charlotte', 4.0, null, 36.32536, -80.08642),
  ('CLT3', '28027', 'NC', '6500 Davidson Hwy', 'Concord', 4.0, null, 35.53477, -78.74681),
  ('CLT6', '28134', 'NC', '12220 Carolina Logistics Drive', 'PINEVILLE', 4.0, null, 36.52301, -80.30603),
  ('CMH2', '43125', 'OH', '6050 Gateway Ct', 'Groveport', 3.5, null, 39.94055, -83.07786),
  ('CMH3', '45050', 'OH', '700 GATEWAY BLVD', 'Monroe', 3.5, null, 39.90525, -83.53903),
  ('CMH6', '43137', 'OH', '3538 TRADEPORT CT', 'LOCKBOURNE', 3.5, null, 40.36408, -81.85903),
  ('CMH7', '43054', 'OH', '1245 BEECH RD SW', 'NEW ALBANY', 3.5, null, 40.32878, -81.67237),
  ('CSG1', '30259', 'GA', '280 BRIDGEPORT BLVD', 'Moreland', 4.0, null, 33.34062, -82.9568),
  ('CTL6', '28134', 'NC', 'Carolina Logistics Dr', 'Pineville', 4.0, null, 35.23124, -79.13112),
  ('DAL2', '75261', 'TX', '2601 S. Airfield Drive', 'DFW Airport', 3.0, null, 30.21802, -98.8317),
  ('DAL3', '75211', 'TX', '1301 Chalk Hill Rd, Dallas, TX 75211', 'Dallas', 3.0, null, 31.00155, -97.62385),
  ('DCA6', '21219', 'MD', '6001 Bethlehem Blvd', 'BALTIMORE', 4.5, null, 39.82983, -76.4123),
  ('DEN2', '80019', 'CO', '22205 East 19th Ave', 'Aurora', 2.0, null, 39.52216, -105.4813),
  ('DEN8', '80018', 'CO', '21000 E 13th Ave.', 'AURORA', 2.0, null, 39.49393, -105.20679),
  ('DET1', '48150', 'MI', '39000 Amrhein Road', 'Livonia', 3.5, null, 42.81485, -84.22315),
  ('DET2', '48317', 'MI', '50500 M ound Rd', 'Shelby Township', 3.5, null, 43.21721, -83.57531),
  ('DFW6', '75019', 'TX', '940 W Bethel Road', 'Coppell', 3.0, null, 30.79684, -98.4364),
  ('DFW7', '76177', 'TX', '700 Westport Pkwy, Fort Worth, TX 76177', 'Fort Worth', 3.0, null, 31.59449, -97.67876),
  ('DFW8', '75261', 'TX', '2700 Regent Blvd DFW Airport', 'Dallas', 3.0, null, 31.02272, -98.62307),
  ('DTW3', '48174', 'MI', '33701 PRESCOTT ST', 'ROMULUS', 3.5, null, 44.15603, -84.10237),
  ('FAT2', '93291', 'CA', '3315 N Kelsey St', 'Visalia', 0.17, null, 36.5715, -119.02823),
  ('FOE1', '66109', 'KS', '9400 LEAVENWORTH RD', 'KANSAS CITY', 3.0, null, 38.42425, -97.34688)
on conflict (fc) do update set
  zip = excluded.zip,
  state = excluded.state,
  address = excluded.address,
  city = excluded.city,
  transit_days = excluded.transit_days,
  remark = excluded.remark,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  updated_at = now();

-- FC seed chunk 2
insert into public.fba_fcs (fc, zip, state, address, city, transit_days, remark, latitude, longitude) values
  ('FTW1', '75241', 'TX', '33333 LBJ FWY', 'Dallas', 3.0, null, 30.43684, -97.85444),
  ('FTW2', '75261', 'TX', '2701 West Bethel Road', 'Coppell', 3.0, null, 30.77566, -98.91954),
  ('FTW3', '76177', 'TX', '15201 Heritage Pkwy', 'Fort Worth', 3.0, null, 31.94743, -98.29366),
  ('FTW5', '75126', 'TX', '1475 Akron Way', 'Forney', 3.0, null, 30.29566, -98.09601),
  ('FTW9', '75019', 'TX', '944 West Sandy Lake Road', 'COPPELL', 3.0, null, 31.51684, -96.40503),
  ('FWA4', '46809', 'IN', '9798 Smith Road', 'FORT WAYNE', 3.5, null, 40.18472, -86.40651),
  ('GEG2', '99216', 'WA', '18007 E Garland Ave', 'SPOKANE', 2.5, null, 48.15267, -121.8254),
  ('GEU2', '85340', 'AZ', '15301 West Northern Avenue', 'Glendale', 1.0, null, 34.11446, -111.51357),
  ('GEU3', '85326', 'AZ', '18900 W McDowell Rd', 'Buckeye', 1.0, null, 33.06976, -112.69946),
  ('GEU5', '85395', 'AZ', '4780 N Cotton Ln', 'Goodyear', 1.0, null, 33.19682, -111.7771),
  ('GSO1', '27284', 'NC', '1656 OLD GREENSBORO RD', 'KERNERSVILLE', 4.0, null, 34.9983, -79.0323),
  ('GSP1', '29303', 'SC', '402 John Dodd Rd', 'Spartanburg', 4.0, null, 34.29101, -81.86187),
  ('GYR2', '85395', 'AZ', '17341 W MINNEZONA AVE', 'GOODYEAR', 1.0, null, 34.42505, -110.85475),
  ('GYR3', '85043', 'AZ', '8181 W ROOSEVELT ST', 'PHOENIX', 1.0, null, 33.83917, -111.84299),
  ('HGR2', '21740', 'MD', '1115 WESEL BLVD', 'HAGERSTOWN', 4.5, null, 38.76395, -76.66485),
  ('HGR6', '21740', 'MD', '55 W Oak Ridge Dr, Hagerstown, MD 21740', 'Hagerstown', 4.5, null, 39.72395, -77.24681),
  ('HIA1', '17057', 'PA', '3327 E Harrisburg Pike, Middletown, PA 17057', 'Middletown', 4.5, null, 40.62958, -78.23642),
  ('HLI2', '95023', 'CA-N', '600 Ernie Dr, Hollister, CA 95023', 'Hollister', 0.25, null, 36.07032, -118.39137),
  ('HOU1', '77338', 'TX', '8120 Humble Westfield Rd, Humble, TX 77338', 'Humble', 3.0, null, 31.08625, -98.45836),
  ('HOU2', '77038', 'TX', '10550 Ella Blvd, Houston, TX 77038', 'Houston', 3.0, null, 30.49331, -98.82072),
  ('HOU3', '77423', 'TX', '31555 US-90, Brookshire, TX 77423', 'Brookshire', 3.0, null, 30.36625, -96.51483),
  ('HOU7', '77064', 'TX', '16225 TOMBALL PKWYBLDG', 'AHOUSTON', 3.0, null, 30.57096, -97.42621),
  ('HOU8', '77545', 'TX', '2303 Hurricane Ln', 'Fresno', 3.0, null, 31.48155, -98.16189),
  ('HSV1', '35756', 'AL', '7817 Greenbrier Road', 'MADISON', 3.5, null, 32.53491, -86.92838),
  ('HSV2', '35756', 'AL', '28869 Fanning Dr NW', 'MADISON', 3.5, null, 31.97726, -87.19191),
  ('IAH1', '75241', 'TX', '9155 Southlink Dr', 'Dallas', 3.0, null, 31.10037, -96.83326),
  ('IAH3', '77032', 'TX', '15525 Milner Road', 'HOUSTON', 3.0, null, 30.38743, -97.19562),
  ('ICT2', '67219', 'KS', '7130 N BROADWAY', 'AVEPARK CITY', 3.0, null, 38.92542, -97.57747),
  ('IGQ2', '60484', 'IL', '23257 Central Ave', 'University Park', 3.5, null, 41.10828, -89.35398),
  ('ILG1', '19720', 'DE', '780 S. DuPont Highway', 'NEW CASTLE', 4.5, null, 38.46793, -74.46949),
  ('IND2', '46168', 'IN', '715 Airtech Pkwy', 'Plainfield', 3.5, null, 39.57766, -87.44965),
  ('IND4', '46231', 'IN', '710 South Girls School Rd,', 'Indianapolis', 3.5, null, 38.95648, -87.44965),
  ('IND5', '46168', 'IN', '800 S Perry Rd,', 'Plainfield', 3.5, null, 40.60119, -86.35161),
  ('IND9', '46143', 'IN', '1151 S GRAHAM RD', 'GREENWOOD', 3.5, null, 39.50001, -85.12181),
  ('IUSF', '75241', 'TX', '3351 Balmorhea Dr.,DALLAS,TX,75241,US', 'DALLAS', 3.0, null, 30.59213, -98.00817),
  ('IUSJ', '92223', 'CA', '36900 West 4th Street', 'BEAUMONT', 0.04, null, 36.64914, -120.22509),
  ('IUSL', '21901', 'MD', '600 PRINCIPIO PKWY W', 'NORTH EAST', 4.5, null, 39.22277, -77.88367),
  ('IUSP', '92344', 'CA', '8140 Caliente Rd', 'HESPERIA', 0.04, null, 35.6115, -119.51137),
  ('IUSQ', '92374', 'CA', '2125 W San Bernardino Ave', 'REDLANDS', 0.04, null, 36.69856, -118.67686),
  ('IUST', '17225', 'PA', '15651 Greenmount Rd', 'GREENCASTLE', 4.5, null, 40.76369, -76.67721),
  ('IUSW', '92344', 'CA', '8130 Caliente Rd', 'Hesperia', 0.04, null, 36.96679, -119.10509),
  ('IUTE', '85338', 'AZ', '16155 W Elwood St', 'Goodyear', 1.0, null, 33.00623, -111.57946),
  ('IUTI', '92374', 'CA', '1901 California St', 'Redlands', 0.04, null, 35.80209, -119.97254),
  ('JAX3', '32210', 'FL', '13333 103rd Street', 'Jacksonville', 4.5, null, 27.33216, -82.19737),
  ('JOT1', '92408', 'CA', '1494 S WATERMAN AVE', 'SAN BERNARDINO', 0.04, null, 36.31032, -120.3898),
  ('JVL1', '53511', 'WI', '1255 Gateway Blvd', 'BELOIT', 3.5, null, 43.81325, -88.21651),
  ('LAL1', '33811', 'FL', '1760 County Line Rd.', 'Lakeland', 4.5, null, 27.36746, -80.29776),
  ('LAN2', '48917', 'MI', 'Amazon.com Services LLC, 6500 W Mt Hope Hwy', 'Lansing', 3.5, null, 43.17485, -85.32119),
  ('LAS1', '89044', 'NV', '12300 Bermuda Road', 'HENDERSON', 1.0, null, 38.33822, -116.17145),
  ('LAS6', '89115', 'NV', '4550 Nexus Way', 'Las Vegas', 1.0, null, 37.90763, -115.82008)
on conflict (fc) do update set
  zip = excluded.zip,
  state = excluded.state,
  address = excluded.address,
  city = excluded.city,
  transit_days = excluded.transit_days,
  remark = excluded.remark,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  updated_at = now();

-- FC seed chunk 3
insert into public.fba_fcs (fc, zip, state, address, city, transit_days, remark, latitude, longitude) values
  ('LAX9', '92337', 'CA', '11263 Oleander Ave', 'FONTANA', 0.0, null, 36.06326, -120.19215),
  ('LBE1', '15672', 'PA', '165 Glenn Fox Rd, New Stanton, PA 15672', 'New Stanton', 4.5, null, 40.9684, -77.92897),
  ('LFT1', '70520', 'LA', '3550 NE EVANGELINE TRWY', 'CARENCRO', 3.5, null, 30.91896, -90.68741),
  ('LGB4', '92374', 'CA', '27517 Pioneer Avenue', 'Redlands', 0.04, null, 36.48679, -119.17098),
  ('LGB6', '92518', 'CA', '20901 Krameria Ave', 'Riverside', 0.04, null, 36.08444, -118.31451),
  ('LGB8', '92376', 'CA', '1568 N Linden Ave', 'Rialto', 0.04, null, 35.7315, -118.55607),
  ('LGB9', '92571', 'CA', '4375 N Perris Blvd.PERRIS', 'Perris', 0.04, null, 35.2515, -119.8298),
  ('LIT2', '72117', 'AR', '13001 HIGHWAY 70', 'NORTH LITTLE ROCK', 3.0, null, 34.63441, -92.06018),
  ('MCC1', null, 'CA-N', null, null, 0.29, null, 35.62561, -120.68627),
  ('MCE1', '95380', 'CA-N', '3200 Fulkerth Road', 'TURLOCK', 0.25, null, 35.64679, -120.48862),
  ('MCI3', '64068', 'MO', '2361 S. Withers Road', 'LIBERTY', 3.0, null, 38.04314, -92.41464),
  ('MCO1', '32824', 'FL', '12340 Boggy Creek Rd', 'Orlando', 4.5, null, 28.29216, -82.20835),
  ('MCO2', '32725', 'FL', '2600 N Normandy Blvd', 'Deltona', 4.5, null, 28.33451, -82.43894),
  ('MDT1', '17015', 'PA', '2 Ames Drive', 'Carlisle', 4.5, null, 41.15899, -78.23642),
  ('MDT2', '21901', 'MD', '600 Principio Parkway West', 'North East', 4.5, null, 38.24865, -77.35661),
  ('MDT4', '17408', 'PA', '5125 Commerce Drive', 'YORK', 4.5, null, 41.11663, -77.0176),
  ('MDW2', '60433', 'IL', '250 Emerald Drive', 'Joliet', 3.5, null, 40.05652, -88.40967),
  ('MDW6', '60446', 'IL', '1125 W REMINGTON BLVD', 'ROMEOVILLE', 3.5, null, 39.61181, -88.34378),
  ('MDW8', '60085', 'IL', '1750 Bridge Drive', 'Waukegan', 3.5, null, 40.9671, -90.16653),
  ('MDW9', '60502', 'IL', '2865 Duke Parkway', 'Aurora', 3.5, null, 39.62593, -88.80496),
  ('MEM1', '38118', 'TN', '3292 E Holmes Rd', 'Memphis', 3.5, null, 35.07373, -86.06097),
  ('MEM2', '38611', 'MS', '191 NORFOLK SOUTHERN WAY', 'BYHALIA', 3.5, null, 32.75223, -90.94693),
  ('MEM6', '38654', 'MS', '11505 Progress Way', 'OLIVE BRANCH', 3.5, null, 32.02518, -88.54223),
  ('MEM8', '38611', 'MS', '850 GATEWAY GLOBAL DR', 'BYHALIA', 3.5, null, 31.90518, -88.78379),
  ('MGE1', '30517', 'GA', '650 Broadway Avenue', 'Braselton', 4.0, null, 32.31003, -84.14268),
  ('MGE3', '30549', 'GA', '808 Hog Mountain Road', 'Jefferson', 4.0, null, 32.41591, -83.967),
  ('MIT2', '93263', 'CA', '5408 Express Ave', 'Shafter', 0.12, null, 35.7315, -118.45725),
  ('MKC4', '66021', 'KS', '19645 Waverly Rd', 'Edgerton', 3.0, null, 38.60072, -96.58923),
  ('MLB1', '32926', 'FL', '3655 GRISSOM PKWY,COCOA,FL,32926,US', 'COCOA', 4.5, null, 27.0851, -80.7809),
  ('MQJ1', '46140', 'IN', '4412 W 300 N', 'GREENFIELD', 3.5, null, 39.74001, -86.81279),
  ('MQJ2', '46184', 'IN', '19 BOB GLIDDEN BLVD', 'WHITELAND', 3.5, null, 39.17531, -87.53749),
  ('OAK3', '95363', 'CA', '255 Park Center Drive', 'Patterson', 0.21, null, 36.74091, -120.62039),
  ('OKC2', '73159', 'OK', '8991 S Portland Avenue', 'OKLAHOMA', 3.0, null, 36.09122, -97.45049),
  ('ONT2', '92408', 'CA', '1910 E Central Ave, San Bernardino, CA 92408', 'Bernardino', 0.04, null, 35.64679, -119.54431),
  ('ONT6', '92551', 'CA', '24208 San Michele Rd', 'Moreno Valley', 0.04, null, 36.34561, -120.29098),
  ('ONT8', '92551', 'CA', '24300 Nandina Ave', 'Moreno Valley', 0.04, null, 36.71267, -119.46745),
  ('ONT9', '92374', 'CA', '2125 W. San Bernandino Ave', 'Redlands', 0.04, null, 36.57856, -118.90745),
  ('ORD2', '60410', 'IL', '23714 W Amoco Rd', 'CHANNAHON', 3.5, null, 39.97181, -87.86065),
  ('ORF2', '23321', 'VA', '9603 Coach Road', 'Richmond', 4.5, null, 38.25993, -78.17546),
  ('PBI2', '33478', 'FL', '14490 Corporate Rd N', 'Jupiter', 4.5, null, 27.26157, -81.27502),
  ('PBI3', '34981', 'FL', '7600 LTC Pkwy, Fort Pierce, FL 34981', 'Fort Pierce', 4.5, null, 27.16275, -82.0107),
  ('PDX6', '97203', 'OR', '15000 N. Lombard St', 'Portland', 2.0, null, 44.15202, -120.75878),
  ('PDX7', '97317', 'OR', '4775 Depot Ct SE', 'Salem', 2.0, null, 45.23908, -120.78074),
  ('PHL4', '17015', 'PA', '21 Roadway Drive', 'Carlisle', 4.5, null, 41.42722, -77.81917),
  ('PHL5', '17339', 'PA', '500 McCarthy Dr', 'Lewisberry', 4.5, null, 39.69781, -77.67642),
  ('PHL6', '17015', 'PA', '675 Allen Rd.', 'Carlisle', 4.5, null, 40.53781, -78.12662),
  ('PHX3', '85043', 'AZ', '6835 W. Buckeye Rd', 'Phoenix', 1.0, null, 33.32388, -110.33867),
  ('PHX5', '85338', 'AZ', '16920 W Commerce Drive', 'Goodyear', 1.0, null, 33.10505, -112.7324),
  ('PHX7', '85043', 'AZ', '800 N 75th Ave', 'Phoenix', 1.0, null, 33.02741, -112.07357),
  ('PIT1', '15205', 'PA', '2250 Roswell Drive', 'Pittsburgh', 4.5, null, 40.64369, -77.41289)
on conflict (fc) do update set
  zip = excluded.zip,
  state = excluded.state,
  address = excluded.address,
  city = excluded.city,
  transit_days = excluded.transit_days,
  remark = excluded.remark,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  updated_at = now();

-- FC seed chunk 4
insert into public.fba_fcs (fc, zip, state, address, city, transit_days, remark, latitude, longitude) values
  ('PIT2', '15126', 'PA', '1200 Westport Rd', 'IMPERIAL', 4.5, null, 40.95428, -76.47956),
  ('POC1', '92336', 'CA', '4121 Lytle Creek Rd, Fontana, CA 92336', 'Fontana', 0.04, null, 36.16914, -120.32392),
  ('POC2', '91761', 'CA', '4000 Hamner Ave, Ontario, CA 91761', 'SMITHFIELD', 0.04, null, 35.2162, -119.87372),
  ('POC3', '92509', 'CA', '6120 Clinker Dr, Jurupa Valley, CA 92509', 'Jurupa Valley', 0.04, null, 36.19738, -119.07215),
  ('PPO4', '46307', 'IN', '9850 Mississippi St, Crown Point, IN 46307', 'Crown Point', 3.5, null, 39.65531, -85.05593),
  ('PSC2', '99301', 'WA', '1351 S Road 40 E', 'PASCO', 2.5, null, 47.50325, -120.33206),
  ('PSP3', null, 'CA', null, null, 0.08, null, 36.76209, -121.07058),
  ('QXY5', '95215', 'CA-N', '4532 NEWCASTLE RD', 'STOCKTON', 0.25, null, 36.7762, -118.38039),
  ('QXY8', null, 'CA', null, null, 0.17, null, 35.82326, -119.84078),
  ('RDG1', '19526', 'PA', '3563 Mountain Road', 'HAMBURG', 4.5, null, 40.53781, -75.82074),
  ('RDU2', '27577', 'NC', '2150 US HWY 70 Business West,SMITHFIELD,NC,27577,US', 'SMITHFIELD', 4.0, null, 36.36065, -79.70211),
  ('RDU4', '28303', 'NC', '6309 Bragg Blvd', 'FAYETTEVILLE', 4.0, null, 36.32536, -79.78995),
  ('RFD2', '60142', 'IL', '11500 Freeman Road 60142 - HUNTLEY, IL - United States', 'HUNTLEY', 3.5, null, 40.4871, -88.75006),
  ('RFD4', '60142', 'IL', '11400 Venture Court', 'HUNTLEY', 3.5, null, 41.23534, -88.1681),
  ('RIC1', '23803', 'VA', '5000 Commerce Way', 'Petersburg', 4.5, null, 37.61051, -78.77938),
  ('RIC3', '23234', 'VA', '4949 Commerce Rd', 'RICHMOND', 4.5, null, 38.60581, -78.85624),
  ('RMN3', '17057', 'VA', '220 Centreport Parkway', 'FREDERICKSBURG', 4.5, null, 37.37757, -79.26252),
  ('RNO4', '89506', 'NV', '8000 North Virginia Street', 'Reno', 1.0, null, 38.49352, -116.44596),
  ('RYY2', '30184', 'GA', '1250 Cassville White Rd, White, GA 30184', 'White', 4.0, null, 33.72885, -83.35209),
  ('SAT1', '78154', 'TX', '6000 Enterprise Avenue', 'Schertz', 3.0, null, 31.94037, -98.66699),
  ('SAT4', '78245', 'TX', '10384 W US HIGHWAY 90', 'SAN ANTONIO', 3.0, null, 31.62272, -98.69993),
  ('SAT6', '78666', 'TX', '1346 Fortuna Road', 'SAN MARCOS', 3.0, null, 31.33331, -96.62464),
  ('SAV3', '31216', 'GA', '7001 Skipper Rd,', 'Macon', 4.0, null, 32.31709, -84.17562),
  ('SBD1', '92316', 'CA', '3388 S Cactus Ave', 'BLOOMINGTON', 0.04, null, 35.34326, -120.28),
  ('SBD2', '92408', 'CA', '1494 S WATERMAN AVE', 'SAN BERNARDINO', 0.04, null, 36.61385, -119.16),
  ('SBD3', '92407', 'CA', '5990 N Cajon Blvd', 'SAN BERNARDINO', 0.04, null, 36.55738, -120.06039),
  ('SCK1', '95215', 'CA-N', '4532 NEWCASTLE RD', 'STOCKTON', 0.25, null, 35.9362, -120.52156),
  ('SCK3', '95336', 'CA-N', '3565 N AIRPORT WAY', 'MANTECA', 0.25, null, 35.36444, -119.87372),
  ('SCK4', '95215', 'CA-N', '6001 S AUSTIN RD', 'STOCKTON', 0.25, null, 35.85856, -119.2149),
  ('SCK8', '94561', 'CA-N', '4700 WILBUR AVE', 'OAKLEY', 0.25, null, 35.42797, -120.45568),
  ('SDF4', '40165', 'KY', '376 Zappos.com Blvd', 'Shepherdsville', 3.5, null, 38.01049, -83.5885),
  ('SDF8', '47130', 'IN', '900 Patrol Rd', 'Jeffersonville', 3.5, null, 40.54472, -86.06612),
  ('SJC7', '95377', 'CA', '188 Mountain House Parkway', 'Tracy', 0.21, null, 36.66326, -120.96078),
  ('SLC1N', '84116', 'UT', '990 N 6550 W Salt Lake City UT 84116', null, 1.5, null, 39.71591, -111.7691),
  ('SLC2', '84081', 'UT', '7148 W. Old Bingham Hwy', 'West Jordan', 1.5, null, 40.46415, -110.69302),
  ('SLC3', '84116', 'UT', '355 N JOHN GLENN RD', 'SALT LAKE CITY', 1.5, null, 39.73003, -110.50636),
  ('SMF3', '95206', 'CA-N', 'SMF3 3923 S B ST', 'Stockton', 0.25, null, 36.31032, -119.02823),
  ('SMF6', '95837', 'CA-N', '4930 Allbaugh Dr', 'Sacramento', 0.29, null, 36.38091, -120.84),
  ('SMF7', '95688', 'CA-N', '4800 MIDDAY ROAD', 'VACAVILLE', 0.29, null, 35.66797, -119.76392),
  ('SNA4', '92376', 'CA', '2496 W Walnut Ave', 'Rialto', 0.04, null, 35.50561, -119.62117),
  ('STL3', '65738', 'MO', '3200 E SAWYER RD', 'REPUBLIC', 3.0, null, 39.2502, -93.47974),
  ('STL4', '62025', 'IL', '3050 GATEWAY COMMERCE CENTER DR S', 'Edwardsville', 3.5, null, 40.01416, -88.96967),
  ('STL6', '62025', 'IL', '3931 Lakeview Corporate Drive', 'Edwardsville', 3.5, null, 40.33887, -87.63006),
  ('SWF1', '12575', 'NY', '635 INTERNATIONAL BLVD', 'ROCK TAVERN', 5.0, null, 41.66808, -74.2508),
  ('SWF2', '12533', 'NY', '76 Patriot Way', 'Hopewell Junction', 5.0, null, 42.89631, -73.88844),
  ('TCY1', '95206', 'CA-N', '2690 East Arch Airport Road,STOCKTON,CA,95206,US', 'STOCKTON', 0.25, null, 35.6115, -119.34666),
  ('TCY2', '95215', 'CA-N', '6201 Newcastle Rd,', 'Stockton', 0.25, null, 36.32444, -119.46745),
  ('TEB3', '08085', 'NJ', '2651 Oldmans Creek Rd', 'Logan Township', 4.5, null, 40.66949, -73.99944),
  ('TEB4', '08069', 'NJ', '747 Courses Landing Rd', 'Penns Grove', 4.5, null, 40.97302, -74.05434),
  ('TEB6', '08512', 'NJ', '22 Hightstown Cranbury State Road', 'Cranbury', 4.5, null, 40.38008, -75.40493)
on conflict (fc) do update set
  zip = excluded.zip,
  state = excluded.state,
  address = excluded.address,
  city = excluded.city,
  transit_days = excluded.transit_days,
  remark = excluded.remark,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  updated_at = now();

-- FC seed chunk 5
insert into public.fba_fcs (fc, zip, state, address, city, transit_days, remark, latitude, longitude) values
  ('TEB9', '08873', 'NJ', '601 Randolph Road', 'SOMERSET', 4.5, null, 41.13537, -75.1414),
  ('TMB8', '33032', 'FL', '27505 SW 132nd Ave, Homestead, FL 33032', 'Homestead', 4.5, null, 28.63098, -82.31816),
  ('TPA2', '33811', 'FL', '1760 County Line Rd', 'Lakeland', 4.5, null, 28.21451, -81.35188),
  ('TPA3', '33823', 'FL', '676 C Fred Jones Blvd', 'Auburndale', 4.5, null, 27.58628, -81.63737),
  ('TPA6', '34475', 'FL', '3400 NW 35th Avenue Road', 'OCALA', 4.5, null, 27.7204, -80.95659),
  ('TTN2', '08512', 'NJ', '343 HALF ACRE RD', 'CRANBURY', 4.5, null, 40.21773, -75.10846),
  ('VGT2', '89115', 'NV', '6401 Howdy Wells Ave, LAS VEGAS, NV, 89115', 'LAS VEGAS', 1.0, null, 37.54763, -118.03812),
  ('WBW2', '18447', 'PA', '1300 Corporate Way, Olyphant, PA 18447', 'Olyphant', 4.5, null, 40.29781, -75.98544),
  ('XLX1', '21740', 'MD', '1115 Wesel Blvd', 'HAGERSTOWN', 4.5, null, 38.50277, -76.85151),
  ('XLX6', '28134', 'NC', '12220 Carolina Logistics Drive', 'PINEVILLE', 4.0, null, 35.28065, -80.40485),
  ('XLX7', '92394', 'CA', '18580 GATEWAY DR VICTORVILLE CA 92394', 'VICTORVILLE', 0.04, null, 35.36444, -121.07058),
  ('XON1', '92374', 'CA', '2290 Palmetto Ave', 'Redlands', 0.04, null, 36.58561, -118.78666)
on conflict (fc) do update set
  zip = excluded.zip,
  state = excluded.state,
  address = excluded.address,
  city = excluded.city,
  transit_days = excluded.transit_days,
  remark = excluded.remark,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  updated_at = now();
