; HEADER_BLOCK_START
; BambuStudio 02.07.01.62
; model printing time: 1d 1h 26m 54s; total estimated time: 1d 1h 33m 48s
; total layer number: 583
; total filament length [mm] : 61352.43
; total filament volume [cm^3] : 147569.88
; total filament weight [g] : 185.94
; filament_density: 1.26
; filament_diameter: 1.75
; max_z_height: 139.88
; filament: 1
; HEADER_BLOCK_END

; CONFIG_BLOCK_START
; accel_to_decel_enable = 0
; accel_to_decel_factor = 50%
; activate_air_filtration = 0
; additional_cooling_fan_speed = 70
; additional_fan_full_speed_layer = 0
; alternate_extra_wall = 0
; apply_scarf_seam_on_circles = 1
; auxiliary_fan = 0
; avoid_crossing_wall_includes_support = 0
; bed_custom_model = 
; bed_custom_texture = 
; bed_exclude_area = 
; bed_temperature_formula = by_first_filament
; before_layer_change_gcode = 
; best_object_pos = 0.5,0.5
; bottom_color_penetration_layers = 3
; bottom_shell_layers = 3
; bottom_shell_thickness = 0
; bottom_surface_density = 100%
; bottom_surface_pattern = monotonic
; bridge_angle = 0
; bridge_flow = 1
; bridge_no_support = 0
; bridge_speed = 50
; brim_object_gap = 0.1
; brim_type = auto_brim
; brim_width = 5
; chamber_temperatures = 0
; change_filament_gcode = ;======== A2L filament_change gcode ==========\n;===== 2026/05/26 =====\n\nM620 S[next_filament_id]A\nM204 S9000\n{if toolchange_count > 1 && (z_hop_types[current_filament_id] == 0 || z_hop_types[current_filament_id] == 3)}\nG17\nG2 Z{z_after_toolchange + 0.4} I0.86 J0.86 P1 F10000 ; spiral lift a little from second lift\n{endif}\n\n;nozzle_change_gcode\n\nG1 Z{max_layer_z + 3.0} F1200\n\nM400\nM106 P1 S0\n\n{if toolchange_count == 2}\n; get travel path for change filament\n;M620.1 X[travel_point_1_x] Y[travel_point_1_y] F21000 P0\n;M620.1 X[travel_point_2_x] Y[travel_point_2_y] F21000 P1\n;M620.1 X[travel_point_3_x] Y[travel_point_3_y] F21000 P2\n{endif}\n\n{if ((filament_type[current_filament_id] == \"PLA\") || (filament_type[current_filament_id] == \"PLA-CF\") || (filament_type[current_filament_id] == \"PETG\") || (filament_type[current_filament_id] == \"PETG-CF\")) && (nozzle_diameter_at_nozzle_id[current_nozzle_id] == 0.2)}\nM620.10 A0 F74.8347 L[flush_length] H{nozzle_diameter_at_nozzle_id[current_nozzle_id]} T{flush_temperatures[current_filament_id]} P[old_filament_temp] S1\n{else}\nM620.10 A0 F{flush_volumetric_speeds[current_filament_id]/2.4053*60} L[flush_length] H{nozzle_diameter_at_nozzle_id[current_nozzle_id]} T{flush_temperatures[current_filament_id]} P[old_filament_temp] S1\n{endif}\n\n{if ((filament_type[next_filament_id] == \"PLA\") || (filament_type[next_filament_id] == \"PLA-CF\") || (filament_type[next_filament_id] == \"PETG\") || (filament_type[next_filament_id] == \"PETG-CF\")) && (nozzle_diameter_at_nozzle_id[next_nozzle_id] == 0.2)}\nM620.10 A1 F74.8347 L[flush_length] H{nozzle_diameter_at_nozzle_id[next_nozzle_id]} T{flush_temperatures[next_filament_id]} P[new_filament_temp] S1\n{else}\nM620.10 A1 F{flush_volumetric_speeds[next_filament_id]/2.4053*60} L[flush_length] H{nozzle_diameter_at_nozzle_id[next_nozzle_id]} T{flush_temperatures[next_filament_id]} P[new_filament_temp] S1\n{endif}\n\n{if long_retraction_when_cut}\nM620.11 P1 L0 I[current_filament_id] E-{retraction_distance_when_cut} F{max((flush_volumetric_speeds[current_filament_id]/2.4053*60), 200)}\n{else}\nM620.11 P0 L0 I[current_filament_id] E0\n{endif}\n\nM620.11 K0 I[current_filament_id] R0\n\n\nT[next_filament_id]\n\n;deretract\n{if filament_type[next_filament_id] == \"TPU\"}\n{else}\n;VG1 E4 F{max(new_filament_e_feedrate, 200)}\n;VG1 E4 F{max(new_filament_e_feedrate/2, 100)}\n{endif}\n\n\n; VFLUSH_START\n\n{if flush_length>41.5}\n;VG1 E41.5 F{min(old_filament_e_feedrate,new_filament_e_feedrate)}\n;VG1 E{flush_length-41.5} F{new_filament_e_feedrate}\n{else}\n;VG1 E{flush_length} F{min(old_filament_e_feedrate,new_filament_e_feedrate)}\n{endif}\n\nSYNC T{ceil(flush_length / 80) * 7.5 + 6.5}\n\n; compensate for heating and cooling\n{if flush_length > 0}\n{if flush_temperatures[next_filament_id] > new_filament_temp}\nSYNC T{(flush_temperatures[next_filament_id]-(new_filament_temp - filament_cooling_before_tower[next_filament_id]))/hotend_cooling_rate[filament_map[next_filament_id]-1]}\nSYNC T{(flush_temperatures[next_filament_id]-(new_filament_temp - filament_cooling_before_tower[next_filament_id]))/hotend_heating_rate[filament_map[next_filament_id]-1]}\n{else}\nSYNC T{(new_filament_temp - filament_cooling_before_tower[next_filament_id] -flush_temperatures[next_filament_id])/hotend_cooling_rate[filament_map[next_filament_id]-1]}\nSYNC T{(new_filament_temp - filament_cooling_before_tower[next_filament_id] -flush_temperatures[next_filament_id])/hotend_heating_rate[filament_map[next_filament_id]-1]}\n{endif}\n{endif}\n\n; VFLUSH_END\n\n\n\nM1002 set_filament_type:{filament_type[next_filament_id]}\n\nM400\nM83\n{if next_filament_id < 255}\nM620.10 R{retract_length_toolchange[filament_map[next_filament_id]-1]}\nM628 S0\n;VM109 S[new_filament_temp]\nM629\nM400\nM983.3 F{filament_max_volumetric_speed[next_filament_id]/2.4} A0.4 R{retract_length_toolchange[filament_map[next_filament_id]-1]}\nM400\n\nG1 Z{max_layer_z + 3.0} F3000\n{if layer_z <= (initial_layer_print_height + 0.001)}\nM204 S[initial_layer_acceleration]\n{else}\nM204 S[travel_acceleration]\n{endif}\n\n{else}\nG1 X[x_after_toolchange] Y[y_after_toolchange] Z[z_after_toolchange] F12000\n{endif}\n\nM621 S[next_filament_id]A\n\nM622.1 S0 ;for prev version, default skip\nM1002 judge_flag powerloss_resume_flag\nM622 J1\nM983.3 F{filament_max_volumetric_speed[next_filament_id]/2.4} A0.4 R{retract_length_toolchange[filament_map[next_filament_id]-1]}\nM400\nG1 Z{max_layer_z + 3.0} F3000\n{if layer_z <= (initial_layer_print_height + 0.001)}\nM204 S[initial_layer_acceleration]\n{else}\nM204 S[travel_acceleration]\n{endif}\nM1002 set_flag powerloss_resume_flag=0\nM623\n\n{if (filament_type[next_filament_id] == \"TPU\")}\nM1015.3 S1 H{nozzle_diameter_at_nozzle_id[next_nozzle_id]};enable tpu clog detect\n{else}\nM1015.3 S0;disable tpu clog detect\n{endif}\n\n{if (filament_type[next_filament_id] == \"PLA\") ||  (filament_type[next_filament_id] == \"PETG\")\n ||  (filament_type[next_filament_id] == \"PLA-CF\")  ||  (filament_type[next_filament_id] == \"PETG-CF\")}\nM1015.4 S1 K1 H{nozzle_diameter_at_nozzle_id[next_nozzle_id]} ;enable E air printing detect\n{else}\nM1015.4 S0 K0 H{nozzle_diameter_at_nozzle_id[next_nozzle_id]} ;disable E air printing detect\n{endif}\n\n{if ((filament_type[next_filament_id] == \"PETG\") || (filament_type[next_filament_id] == \"PETG-CF\") || (filament_type[next_filament_id] == \"TPU\") || (filament_type[next_filament_id] == \"TPU-AMS\"))}\n  G390.7 M6 G4 C3\n{else}\n  G390.7 M6 G6 C3\n{endif}\n\nM620.6 I[next_filament_id] W1 ;enable ams air printing detect\n\n;Set the filament gear warning temperature\n{if (temperature_vitrification[next_filament_id] <= 50)}\n    {if ((filament_ids[next_filament_id]==\"GFA05\") || (filament_ids[next_filament_id]==\"GFA06\"))}\n        M142 P1 O45; set PLASILK gear warning temperature when filament change\n    {else}\n        M142 P1 O60; set PLA/PLACF/PLAAERO/PVA/TPU gear warning temperature when filament change\n    {endif}\n{else}\n    M142 P1 O100 ; set gear warning temperature when filament change\n{endif}\n
; circle_compensation_manual_offset = 0
; circle_compensation_speed = 200
; close_additional_fan_first_x_layers = 1
; close_fan_the_first_x_layers = 1
; complete_print_exhaust_fan_speed = 70
; cool_plate_temp = 35
; cool_plate_temp_initial_layer = 35
; cooling_filter_enabled = 0
; cooling_perimeter_transition_distance = 10
; cooling_slowdown_logic = uniform_cooling
; counter_coef_1 = 0
; counter_coef_2 = 0.008
; counter_coef_3 = -0.041
; counter_limit_max = 0.033
; counter_limit_min = -0.035
; curr_bed_type = Textured PEI Plate
; default_acceleration = 6000
; default_filament_colour = ""
; default_filament_profile = "Bambu PLA Basic @BBL A2L 0.4 nozzle"
; default_jerk = 0
; default_nozzle_volume_type = Standard
; default_print_profile = 0.20mm Standard @BBL A2L
; deretraction_speed = 30
; detect_floating_vertical_shell = 1
; detect_narrow_internal_solid_infill = 1
; detect_overhang_wall = 1
; detect_thin_wall = 0
; diameter_limit = 50
; draft_shield = disabled
; during_print_exhaust_fan_speed = 70
; elefant_foot_compensation = 0.075
; embedding_wall_into_infill = 0
; enable_arc_fitting = 0
; enable_circle_compensation = 0
; enable_filament_dynamic_map = 0
; enable_height_slowdown = 1
; enable_long_retraction_when_cut = 2
; enable_mixed_color_sublayer = 0
; enable_order_independent_overlap_carving = 0
; enable_overhang_bridge_fan = 1
; enable_overhang_speed = 1
; enable_pre_heating = 0
; enable_pressure_advance = 0
; enable_prime_tower = 0
; enable_support = 0
; enable_support_ironing = 0
; enable_tower_interface_features = 0
; enable_wrapping_detection = 0
; enforce_support_layers = 0
; eng_plate_temp = 55
; eng_plate_temp_initial_layer = 55
; ensure_vertical_shell_thickness = enabled
; exclude_object = 1
; extruder_ams_count = 1#0|4#0;1#0|4#0
; extruder_clearance_dist_to_rod = 56.5
; extruder_clearance_height_to_lid = 325
; extruder_clearance_height_to_rod = 25
; extruder_clearance_max_radius = 73
; extruder_colour = #018001
; extruder_max_nozzle_count = 1
; extruder_nozzle_stats = Standard#1
; extruder_offset = 0x0
; extruder_printable_area = 
; extruder_type = Direct Drive
; extruder_variant_list = "Direct Drive Standard"
; fan_cooling_layer_time = 80
; fan_direction = undefine
; fan_max_speed = 80
; fan_min_speed = 60
; filament_adaptive_volumetric_speed = 0
; filament_adhesiveness_category = 100
; filament_bridge_speed = 25
; filament_change_length = 5
; filament_change_length_nc = 10
; filament_colour = #00AE42
; filament_colour_type = 1
; filament_cooling_before_tower = 0
; filament_cost = 24.99
; filament_density = 1.26
; filament_dev_ams_drying_ams_limitations = 1;0
; filament_dev_ams_drying_heat_distortion_temperature = 45
; filament_dev_ams_drying_temperature = 45,45,45,45
; filament_dev_ams_drying_time = 12,12,12,12
; filament_dev_chamber_drying_bed_temperature = 70
; filament_dev_chamber_drying_time = 12
; filament_dev_drying_cooling_temperature = 45
; filament_dev_drying_softening_temperature = 50
; filament_diameter = 1.75
; filament_enable_overhang_speed = 1
; filament_end_gcode = "; filament end gcode \n\n"
; filament_extruder_compatibility = 0
; filament_extruder_variant = "Direct Drive Standard"
; filament_flow_ratio = 0.98
; filament_flush_temp = 0
; filament_flush_temp_fast = 220
; filament_flush_volumetric_speed = 0
; filament_ids = GFA00
; filament_is_mixed = 0
; filament_is_support = 0
; filament_long_retractions_when_cut = 1
; filament_map = 1
; filament_map_2 = 0
; filament_map_mode = Auto For Flush
; filament_max_volumetric_speed = 23
; filament_metal_stickiness = None
; filament_minimal_purge_on_wipe_tower = 15
; filament_mixed_components = ""
; filament_mixed_gradient = 0
; filament_mixed_gradient_curve = ""
; filament_mixed_gradient_per_part = 0
; filament_mixed_gradient_range = ""
; filament_mixed_sublayer_ratios = ""
; filament_multi_colour = #00AE42
; filament_notes = 
; filament_nozzle_map = 0
; filament_overhang_1_4_speed = 0
; filament_overhang_2_4_speed = 50
; filament_overhang_3_4_speed = 30
; filament_overhang_4_4_speed = 10
; filament_overhang_totally_speed = 10
; filament_pre_cooling_temperature = 0
; filament_pre_cooling_temperature_nc = 0
; filament_preheat_temperature_delta = 0
; filament_prime_volume = 30
; filament_prime_volume_nc = 60
; filament_printable = 3
; filament_ramming_travel_time = 0
; filament_ramming_travel_time_nc = 0
; filament_ramming_volumetric_speed = -1
; filament_ramming_volumetric_speed_nc = -1
; filament_retract_length_nc = 14
; filament_retraction_distances_when_cut = 18
; filament_retraction_length = 0.4
; filament_scarf_gap = 0%
; filament_scarf_height = 10%
; filament_scarf_length = 10
; filament_scarf_seam_type = none
; filament_self_index = 1
; filament_settings_id = "Bambu PLA Basic @BBL A2L 0.4 nozzle"
; filament_shrink = 100%
; filament_soluble = 0
; filament_start_gcode = ""
; filament_tower_interface_pre_extrusion_dist = 10
; filament_tower_interface_pre_extrusion_length = 0
; filament_tower_interface_print_temp = -1
; filament_tower_interface_purge_volume = 20
; filament_tower_ironing_area = 4
; filament_type = PLA
; filament_velocity_adaptation_factor = 1
; filament_vendor = "Bambu Lab"
; filament_volume_map = 0
; filament_wipe = 1
; filament_wipe_distance = 1
; filament_z_hop_types = Spiral Lift
; filename_format = {input_filename_base}_{filament_type[0]}_{print_time}.gcode
; fill_multiline = 1
; filter_out_gap_fill = 0
; first_layer_print_sequence = 0
; first_x_layer_fan_speed = 0
; first_x_layer_part_fan_speed = 0
; flush_into_infill = 0
; flush_into_objects = 0
; flush_into_support = 1
; flush_multiplier = 1
; flush_multiplier_fast = 1.2
; flush_volumes_matrix = 0
; flush_volumes_vector = 140,140
; full_fan_speed_layer = 0
; fuzzy_skin = none
; fuzzy_skin_first_layer = 0
; fuzzy_skin_mode = displacement
; fuzzy_skin_noise_type = classic
; fuzzy_skin_octaves = 4
; fuzzy_skin_persistence = 0.5
; fuzzy_skin_point_distance = 0.8
; fuzzy_skin_scale = 1
; fuzzy_skin_thickness = 0.3
; gap_infill_speed = 230
; gcode_add_line_number = 0
; gcode_flavor = marlin
; grab_length = 17.4
; group_algo_with_time = 0
; has_filament_switcher = 0
; has_scarf_joint_seam = 0
; head_wrap_detect_zone = 226x224,256x224,256x256,226x256
; hole_coef_1 = 0
; hole_coef_2 = -0.008
; hole_coef_3 = 0.23415
; hole_limit_max = 0.22
; hole_limit_min = 0.088
; host_type = octoprint
; hot_plate_temp = 55
; hot_plate_temp_initial_layer = 55
; hotend_cooling_rate = 2
; hotend_heating_rate = 2
; impact_strength_z = 13.8
; independent_support_layer_height = 1
; infill_combination = 0
; infill_direction = 45
; infill_instead_top_bottom_surfaces = 0
; infill_jerk = 9
; infill_lock_depth = 1
; infill_rotate_step = 0
; infill_shift_step = 0.4
; infill_wall_overlap = 15%
; initial_layer_acceleration = 500
; initial_layer_flow_ratio = 1
; initial_layer_infill_speed = 105
; initial_layer_jerk = 9
; initial_layer_line_width = 0.5
; initial_layer_print_height = 0.2
; initial_layer_speed = 50
; initial_layer_travel_acceleration = 6000
; inner_wall_acceleration = 0
; inner_wall_jerk = 9
; inner_wall_line_width = 0.45
; inner_wall_speed = 230
; interface_shells = 0
; interlocking_beam = 0
; interlocking_beam_layer_count = 2
; interlocking_beam_width = 0.8
; interlocking_boundary_avoidance = 2
; interlocking_depth = 2
; interlocking_orientation = 22.5
; internal_bridge_support_thickness = 0.8
; internal_solid_infill_line_width = 0.42
; internal_solid_infill_pattern = zig-zag
; internal_solid_infill_speed = 230
; ironing_direction = 45
; ironing_fan_speed = -1
; ironing_flow = 10%
; ironing_inset = 0.21
; ironing_pattern = zig-zag
; ironing_spacing = 0.15
; ironing_speed = 30
; ironing_type = no ironing
; is_infill_first = 0
; layer_change_gcode = ;======== A2L layer_change gcode ==========\n;===== 2026/04/29 ====\n; update layer progress\nM201 N1 Y[curr_y_acceleration_limit]\nM73 L{layer_num+1}\nM991 S0 P{layer_num} ;notify layer change\nM1007 L1
; layer_height = 0.24
; line_width = 0.42
; locked_skeleton_infill_pattern = zigzag
; locked_skin_infill_pattern = crosszag
; long_retractions_when_cut = 0
; long_retractions_when_ec = 0
; machine_bed_mass_Y = 2700
; machine_end_gcode = ;======== A2L end gcode ==========\n;===== 2026/04/07 =====\nM400 ; wait for buffer to clear\nG92 E0 ; zero the extruder\n\n; pull back filament to AMS\nM620 S65535\nT65535\nG150.2\nM621 S65535\nG150.3\nG1 Y295 F3600\nG90\nG1 Z{max_layer_z + 0.4} F900 ; lower z a little\nM1002 judge_flag timelapse_record_flag\nM622 J1\n    M400 ; wait all motion done\n    M991 S0 P-1 ;end smooth timelapse at safe pos\n    M400 S5 ;wait for last picture to be taken\nM623  ;end of \"timelapse_record_flag\"\n\nM106 S0 ; turn off fan\nM106 P2 S0 ; turn off remote part cooling fan\nM106 P3 S0 ; turn off chamber cooling fan\nM142 P1 Q0 ; turn off extruder autocool\n\nM220 S100  ; Reset feedrate magnitude\nM204.2 K1.0 ; Reset acc magnitude\nM73.2 R1.0 ;Reset left time magnitude\n\nM1015.3 S0 ;disable clog detect\nM1015.4 S0 K0 ;disable air printing detect\n;=====printer finish sound=========\nM17\nM400 S1\nM1006 S1\nM1006 A53 B10 L30 C53 D10 M30 E53 F10 N30 \nM1006 A57 B10 L30 C57 D10 M30 E57 F10 N30 \nM1006 A0 B15 L0 C0 D15 M0 E0 F15 N0 \nM1006 A53 B10 L30 C53 D10 M30 E53 F10 N30 \nM1006 A57 B10 L30 C57 D10 M30 E57 F10 N30 \nM1006 A0 B15 L0 C0 D15 M0 E0 F15 N0 \nM1006 A48 B10 L30 C48 D10 M30 E48 F10 N30 \nM1006 A0 B15 L0 C0 D15 M0 E0 F15 N0 \nM1006 A60 B10 L30 C60 D10 M30 E60 F10 N30 \nM1006 W\n;=====printer finish sound=========\nM400\nM18\n\nM104 S0 ; turn off hotend\nM140 S0 ; turn off bed\nM1007 S0
; machine_hotend_change_time = 0
; machine_load_filament_time = 11
; machine_max_acceleration_e = 5000,5000
; machine_max_acceleration_extruding = 12000,12000
; machine_max_acceleration_retracting = 5000,5000
; machine_max_acceleration_travel = 9000,9000
; machine_max_acceleration_x = 12000,12000
; machine_max_acceleration_y = 8000,8000
; machine_max_acceleration_z = 1500,1500
; machine_max_force_Y = 29
; machine_max_jerk_e = 3,3
; machine_max_jerk_x = 9,9
; machine_max_jerk_y = 9,9
; machine_max_jerk_z = 3,3
; machine_max_printed_mass = 2000
; machine_max_speed_e = 30,30
; machine_max_speed_x = 500,500
; machine_max_speed_y = 500,500
; machine_max_speed_z = 30,30
; machine_min_extruding_rate = 0,0
; machine_min_travel_rate = 0,0
; machine_pause_gcode = M400 U1
; machine_prepare_compensation_time = 260
; machine_start_gcode = ;M1002 set_flag extrude_cali_flag=1\n;M1002 set_flag g29_before_print_flag=1\n;M1002 set_flag build_plate_detect_flag=1\n;M1002 set_flag bed_heat_stable_wait_flag=1\n\n;======== A2L start gcode==========\n;===== 2026/05/26 =====\nT1000 O0\nM1002 gcode_claim_action : 2\n{if hold_chamber_temp_for_flat_print && (bed_temperature_initial_layer_single == 55)}\n    M140 S65\n{else}\n    M140 S[bed_temperature_initial_layer_single] ; heat heatbed first\n{endif}\n\nM993 A0 B0 C0 ; nozzle cam detection not allowed.\nM400\n\n;=====printer start sound ===================\nM17\nM400 S1\nM1006 S1\nM1006 A53 B9 L30 C53 D9 M30 E53 F9 N30\nM1006 A56 B9 L30 C56 D9 M30 E56 F9 N30\nM1006 A61 B9 L30 C61 D9 M30 E61 F9 N30\nM1006 A53 B9 L30 C53 D9 M30 E53 F9 N30\nM1006 A56 B9 L30 C56 D9 M30 E56 F9 N30\nM1006 A61 B18 L30 C61 D18 M30 E61 F18 N30\nM1006 W\n;=====printer start sound ===================\n\n  M620 M ;enable remap\n  G389\n\n;===== avoid end stop =================\n  G91\n  G380 S2 Z22 F1200\n  G380 S2 Z-12 F1200\n  G90\n;===== avoid end stop =================\n\n;===== reset machine status =================\n  M204 S10000\n  M630 S0 P1\n  G90\n  M17 D ; reset motor current to default\n  M960 S5 P1 ; turn on logo lamp\n  M220 S100 ;Reset Feedrate\n  M221 S100 ;Reset Flowrate\n  M73.2   R1.0 ;Reset left time magnitude\n  G29.1 Z{+0.0} ; clear z-trim value first\n  M983.1 M1\n  M982.2 S1 ; turn on cog noise reduction\n  M983.4 S0\n;===== reset machine status =================\n;Set the filament gear warning temperature\n{if (temperature_vitrification[initial_filament_id] <= 50)}\n    {if ((filament_ids[initial_filament_id]==\"GFA05\") || (filament_ids[initial_filament_id]==\"GFA06\"))}\n        M142 P1 O45; set PLASILK gear warning temperature when start\n    {else}\n        M142 P1 O60; set PLA/PLACF/PLAAERO/PVA/TPU gear warning temperature when start\n    {endif}\n{else}\n    M142 P1 O100 ; set gear warning temperature when start\n{endif}\n;===== start to heat heatbed & hotend==========\n  M1002 set_filament_type:{filament_type[initial_no_support_filament_id]}\n  M104 S140 A\n\n  G29.2 S0 ; avoid invalid abl data\n\n;===== first homing start =====\n  M1002 gcode_claim_action : 13\n  M105\n  G28 X Z P0 T300 W\n  G150.3\n  G1 Z1.3 F1200\n  G150.1 F16000 ; wipe mouth to avoid filament stick to heatbed\n  G90\n  M400\n;===== first homing end =====\n\n\n;===== detection start =====\n;===== build_plate_detect_flag start =====\nM1002 judge_flag build_plate_detect_flag\nM622 S1\n  G91\n  G1 Z5 F1200\n  G90\n  G0 X15 F30000\n  G0 Y319 F3000\n  G91\n  G1 Z-5 F1200\n  G28 Z P0 T140\n  G1 F1200\n  G39.4\n  G90\n  G1 Z5 F1200\nM623\n;===== build_plate_detect_flag end =====\n;===== detection end =====\n\n\n;===== hotend hotbed pre-heat start =====\n  M104 S{nozzle_temperature_initial_layer[initial_no_support_filament_id]-80} A ; rise nozzle temp in advance\n\n  G90\n  G1 Y220 F3000 ; Put away the heated bed to prevent collisions\n\n  {if hold_chamber_temp_for_flat_print && (bed_temperature_initial_layer_single == 55)}\n      M190 S65\n  {else}\n      M190 S[bed_temperature_initial_layer_single]\n  {endif}\n;===== hotend hotbed pre-heat end =====\n\n\n;===== prepare print temperature and material ==========\n  M400\n  M211 X0 Y0 Z0 ;turn off soft endstop\n  M975 S1 ; turn on input shaping\n\n  G29.2 S0 ; avoid invalid abl data\n  G150.3\n{if ((filament_type[initial_no_support_filament_id] == \"PLA\") || (filament_type[initial_no_support_filament_id] == \"PLA-CF\") || (filament_type[initial_no_support_filament_id] == \"PETG\") || (filament_type[initial_no_support_filament_id] == \"PETG-CF\")) && (nozzle_diameter_at_nozzle_id[initial_nozzle_id] == 0.2)}\nM620.10 A0 F74.8347 H{nozzle_diameter_at_nozzle_id[initial_nozzle_id]} T{flush_temperatures[initial_no_support_filament_id]} P{nozzle_temperature_initial_layer[initial_no_support_filament_id]} S1\nM620.10 A1 F74.8347 H{nozzle_diameter_at_nozzle_id[initial_nozzle_id]} T{flush_temperatures[initial_no_support_filament_id]} P{nozzle_temperature_initial_layer[initial_no_support_filament_id]} S1\n{else}\nM620.10 A0 F{flush_volumetric_speeds[initial_no_support_filament_id]/2.4053*60} H{nozzle_diameter_at_nozzle_id[initial_nozzle_id]} T{flush_temperatures[initial_no_support_filament_id]} P{nozzle_temperature_initial_layer[initial_no_support_filament_id]} S1\nM620.10 A1 F{flush_volumetric_speeds[initial_no_support_filament_id]/2.4053*60} H{nozzle_diameter_at_nozzle_id[initial_nozzle_id]} T{flush_temperatures[initial_no_support_filament_id]} P{nozzle_temperature_initial_layer[initial_no_support_filament_id]} S1\n{endif}\n\n M620.11 P0 L0 I[initial_no_support_filament_id] E0\n M620.11 K0 I[initial_no_support_filament_id] R0\n\n  M620 S[initial_no_support_filament_id]A   ; switch material if AMS exist\n  M1002 gcode_claim_action : 4\n  M1002 set_filament_type:UNKNOWN\n  M400\n  T[initial_no_support_filament_id]\n  M400\n  M628 S0\n  M629\n  M400\n  M1002 set_filament_type:{filament_type[initial_no_support_filament_id]}\n  M621 S[initial_no_support_filament_id]A\n  M104 S{nozzle_temperature_initial_layer[initial_no_support_filament_id]}\n  M400\n  M106 P1 S0\n  M400\n  G29.2 S1\n{if ((filament_type[initial_no_support_filament_id] == \"PETG\") || (filament_type[initial_no_support_filament_id] == \"PETG-CF\") || (filament_type[initial_no_support_filament_id] == \"TPU\") || (filament_type[initial_no_support_filament_id] == \"TPU-AMS\"))}\n  G390.7 M6 G4 C3\n{else}\n  G390.7 M6 G6 C3\n{endif}\n;===== prepare print temperature and material ==========\n\n\n;===== auto extrude cali start =========================\nM975 S1\nM1002 judge_flag extrude_cali_flag\n  M622 J0\n    M983.3 F{filament_max_volumetric_speed[initial_no_support_filament_id]/2.4} A0.4 ; cali dynamic extrusion compensation\n  M623\n\n  M622 J1\n    M1002 set_filament_type:{filament_type[initial_no_support_filament_id]}\n    M1002 gcode_claim_action : 8\n    M109 S{nozzle_temperature[initial_no_support_filament_id]}\n    G90\n    M83\n    M983.3 F{filament_max_volumetric_speed[initial_no_support_filament_id]/2.4} A0.4 ; cali dynamic extrusion compensation\n    M400\n  M623\n\n  M622 J2\n    M1002 set_filament_type:{filament_type[initial_no_support_filament_id]}\n    M1002 gcode_claim_action : 8\n    M109 S{nozzle_temperature[initial_no_support_filament_id]}\n    G90\n    M83\n    M983.3 F{filament_max_volumetric_speed[initial_no_support_filament_id]/2.4} A0.4 ; cali dynamic extrusion compensation\n    M400\n  M623\n;===== auto extrude cali end =========================\n\n\n  {if filament_type[initial_filament_id] == \"TPU\" || filament_type[initial_filament_id] == \"PVA\"}\n  {else}\n    M83\n    G1 E-3 F1800\n    M400 P500\n  {endif}\n  G0 Z1.3 F1200\n  G150.2\n  G150.1 F16000\n\n  G91\n  G1 X20 F12000 ; move away from the trash bin\n  G90\n  M400\n\n\n;===== wipe nozzle start =====\n  M1002 gcode_claim_action : 14\n  G150 T{nozzle_temperature_initial_layer[initial_no_support_filament_id]}\n  M400\n  M109 S140 A\n  M106 P1 S255\n  G91\n  G1 Z1.3 F1200\n  G90\n  M400 S1\n  ;======== enhance brush nozzle start =====\n  G150.1 F16000\n  G91\n  G1 Y5   F5000\n  G1 X-20 F16000\n  G1 Y-10 F5000\n  G1 X-20 F16000\n  G1 Y10  F5000\n  G1 X20  F16000\n  G1 Y-10 F5000\n  G1 X20  F16000\n  G1 Y5   F5000\n  G90\n  G150.1 F16000\n  G150.3\n  ;======== enhance brush nozzle end =====\n  M106 P1 S0\n;===== wipe nozzle end =====\n\n;===== mech mode sweep start =====\n  M1002 gcode_claim_action : 3\n  G90\n  G1 Z5 F1200\n  G1 X165 Y160 F20000\n  M400 P200\n  M970.3 Q1 A5 K0 O3\n  M970.3 Q1 B1\n  M970.2 Q1 K1 W52 Z0.1 B30 ;\n  M970.3 Q0 A10 K0 O1\n  M970.3 Q0 B1\n  M970.2 Q0 K1 W40 Z0.1 B20 ;\n  M974 Q0 S2 P0\n  M974 Q1 S2 P0\n  M975 S1 R1 M1\n  M400\n  G1 X155 F3000\n  G150.3\n;===== mech mode sweep end =====\n\n\n;===== bed leveling ==================================\n\n  {if hold_chamber_temp_for_flat_print && (bed_temperature_initial_layer_single == 55)}\n    M190 S65\n  {else}\n    M190 S[bed_temperature_initial_layer_single] ; ensure bed temp\n  {endif}\n  M109 S140 A\n\n\n  {if hold_chamber_temp_for_flat_print && (bed_temperature_initial_layer_single == 55)}\n    M1002 gcode_claim_action : 58\n    SYNC R0 T600\n    M1030 S500 ; action before has done 200s insulation\n    M1030 C\n  {else}\n    M1002 judge_flag bed_heat_stable_wait_flag\n    M622 J1\n      {if (bed_temperature_initial_layer_single > 35)}\n        M1002 gcode_claim_action : 54\n        G29.30 X{first_layer_print_min[0]} Y{first_layer_print_min[1]} I{first_layer_print_size[0]} J{first_layer_print_size[1]}\n      {endif}\n    M623\n  {endif}\n  SYNC R0 T120 ; Adjust estimated time\n\n  M106 S0 ; turn off fan , too noisy\n  M1002 judge_flag g29_before_print_flag\n  M622 J1\n    M1002 gcode_claim_action : 1\n    {if hold_chamber_temp_for_flat_print && (bed_temperature_initial_layer_single == 55)}\n      G29 R\n    {else}\n      {if (bed_temperature_initial_layer_single > 35)}\n        G29 A1 X{first_layer_print_min[0]} Y{first_layer_print_min[1]} I{first_layer_print_size[0]} J{first_layer_print_size[1]} O1 R\n      {else}\n        G29 A1 X{first_layer_print_min[0]} Y{first_layer_print_min[1]} I{first_layer_print_size[0]} J{first_layer_print_size[1]} O R\n      {endif}\n    {endif}\n    M400\n  M623\n\n  M622 J2\n    M1002 gcode_claim_action : 1\n    {if hold_chamber_temp_for_flat_print && (bed_temperature_initial_layer_single == 55)}\n      G29 R\n    {else}\n      {if (bed_temperature_initial_layer_single > 35)}\n        G29 A2 X{first_layer_print_min[0]} Y{first_layer_print_min[1]} I{first_layer_print_size[0]} J{first_layer_print_size[1]} O1 R\n      {else}\n        G29 A2 X{first_layer_print_min[0]} Y{first_layer_print_min[1]} I{first_layer_print_size[0]} J{first_layer_print_size[1]} O R\n      {endif}\n    {endif}\n    M400\n  M623\n\n  M622 J0\n    G28 R\n  M623\n  G29.2 S1\n;===== bed leveling end ================================\n\n  M985.1 U0 E2\n  M985.1 U1 E2\n\n  M104 S{nozzle_temperature_initial_layer[initial_filament_id]} A\n  G150.3 ; move to garbage can to wait for temp\n\n;===== wait temperature reaching the reference value =======\n  {if hold_chamber_temp_for_flat_print && (bed_temperature_initial_layer_single == 55)}\n    M190 S65\n  {else}\n    M190 S[bed_temperature_initial_layer_single] ; ensure bed temp\n  {endif}\n\n  ;========turn off light and fans =============\n  M960 S1 P0 ; turn off laser\n  M960 S2 P0 ; turn off laser\n  M106 S0 ; turn off cooling fan\n\n;===== wait temperature reaching the reference value =======\n\n  M1002 gcode_claim_action : 255\n  M400\n  M975 S1 ; turn on mech mode supression\n\n;===== for Textured PEI Plate , lower the nozzle as the nozzle was touching topmost of the texture when homing ==\n  {if curr_bed_type==\"Textured PEI Plate\"}\n    {if hold_chamber_temp_for_flat_print && (bed_temperature_initial_layer_single == 55)}\n      G29.1 Z{-0.03} ; for Textured PEI Plate first layer\n    {else}\n      G29.1 Z{-0.04} ; for Textured PEI Plate\n    {endif}\n  {else}\n    G29.1 Z{-0.01}\n  {endif}\n\n;===== nozzle load line ===============================\nM1002 gcode_claim_action : 51\n  G29.2 S1 ; ensure z comp turn on\n  G90\n  M83\n  M400 P50\n  M500 D1\n  M400 S3\n  M109 S{nozzle_temperature_initial_layer[initial_no_support_filament_id]}\n  G0 X145 Y0 F24000\n  M400\n  G130 O0 X145 Y-0.2 Z0.8 F{filament_max_volumetric_speed[initial_no_support_filament_id]/2/2.4053} L40 E20 D4\n  G90\n  M83\n  G1 Z0.2\n  M400\n;===== nozzle load line end ===========================\nM1007 S1 C1;turn on mass estimation && clear\nM1002 gcode_claim_action : 0\n  G29.99\n\n{if (filament_type[initial_no_support_filament_id] == \"TPU\")}\nM1015.3 S1 H{nozzle_diameter_at_nozzle_id[initial_nozzle_id]};enable tpu clog detect\n{else}\nM1015.3 S0;disable tpu clog detect\n{endif}\n\n{if (filament_type[initial_no_support_filament_id] == \"PLA\") ||  (filament_type[initial_no_support_filament_id] == \"PETG\")\n ||  (filament_type[initial_no_support_filament_id] == \"PLA-CF\")  ||  (filament_type[initial_no_support_filament_id] == \"PETG-CF\")}\nM1015.4 S1 K1 H{nozzle_diameter_at_nozzle_id[initial_nozzle_id]} ;enable E air printing detect\n{else}\nM1015.4 S0 K0 H{nozzle_diameter_at_nozzle_id[initial_nozzle_id]} ;disable E air printing detect\n{endif}\n\nM620.6 I[initial_no_support_filament_id] W1 ;enable ams air printing detect\n\nM1010 Q0 B0.005 S0.01\nM1010 Q1 B0.002 S0.01\nM1010.1 S1\n
; machine_switch_extruder_time = 0
; machine_unload_filament_time = 12
; master_extruder_id = 1
; max_bridge_length = 0
; max_layer_height = 0.28
; max_travel_detour_distance = 0
; min_bead_width = 85%
; min_feature_size = 25%
; min_layer_height = 0.08
; minimum_sparse_infill_area = 15
; mmu_segmented_region_interlocking_depth = 0
; mmu_segmented_region_max_width = 0
; monotonic_travel_into_wall = 0%
; no_slow_down_for_cooling_on_outwalls = 0
; nozzle_diameter = 0.4
; nozzle_flush_dataset = 0
; nozzle_height = 4.76
; nozzle_temperature = 220
; nozzle_temperature_initial_layer = 220
; nozzle_temperature_range_high = 240
; nozzle_temperature_range_low = 190
; nozzle_type = stainless_steel
; nozzle_volume = 92
; nozzle_volume_type = Standard
; only_one_wall_first_layer = 0
; ooze_prevention = 0
; other_layers_print_sequence = 0
; other_layers_print_sequence_nums = 0
; outer_wall_acceleration = 5000
; outer_wall_jerk = 9
; outer_wall_line_width = 0.42
; outer_wall_speed = 200
; overhang_1_4_speed = 0
; overhang_2_4_speed = 50
; overhang_3_4_speed = 30
; overhang_4_4_speed = 10
; overhang_fan_speed = 100
; overhang_fan_threshold = 25%
; overhang_threshold_participating_cooling = 95%
; overhang_totally_speed = 10
; override_filament_scarf_seam_setting = 0
; override_process_overhang_speed = 0
; physical_extruder_map = 0
; post_process = 
; pre_start_fan_time = 2
; precise_outer_wall = 0
; precise_z_height = 0
; pressure_advance = 0.02
; prime_tower_brim_width = -1
; prime_tower_enable_framework = 0
; prime_tower_extra_rib_length = 0
; prime_tower_fillet_wall = 1
; prime_tower_flat_ironing = 0
; prime_tower_infill_gap = 150%
; prime_tower_lift_height = -1
; prime_tower_lift_speed = 90
; prime_tower_max_speed = 90
; prime_tower_rib_wall = 1
; prime_tower_rib_width = 8
; prime_tower_skip_points = 1
; prime_tower_width = 35
; prime_volume_mode = Default
; print_compatible_printers = "Bambu Lab A2L 0.4 nozzle"
; print_extruder_id = 1
; print_extruder_variant = "Direct Drive Standard"
; print_flow_ratio = 1
; print_in_clockwise = 0
; print_sequence = by layer
; print_settings_id = 0.24mm Standard @BBL A2L
; printable_area = 0x0,330x0,330x320,0x320
; printable_height = 325
; printer_extruder_id = 1
; printer_extruder_variant = "Direct Drive Standard"
; printer_model = Bambu Lab A2L
; printer_notes = 
; printer_settings_id = Bambu Lab A2L 0.4 nozzle
; printer_structure = i3
; printer_technology = FFF
; printer_variant = 0.4
; printhost_authorization_type = key
; printhost_ssl_ignore_revoke = 0
; printing_by_object_gcode = 
; process_notes = 
; raft_contact_distance = 0.1
; raft_expansion = 1.5
; raft_first_layer_density = 90%
; raft_first_layer_expansion = -1
; raft_layers = 0
; reduce_crossing_wall = 0
; reduce_fan_stop_start_freq = 1
; reduce_infill_retraction_mode = Auto
; required_nozzle_HRC = 3
; resolution = 0.012
; retract_before_wipe = 0%
; retract_length_toolchange = 2
; retract_lift_above = 0
; retract_lift_below = 326
; retract_restart_extra = 0
; retract_restart_extra_toolchange = 0
; retract_when_changing_layer = 1
; retraction_distances_when_cut = 18
; retraction_distances_when_ec = 0
; retraction_length = 0.8
; retraction_minimum_travel = 1
; retraction_speed = 30
; role_base_wipe_speed = 1
; scan_first_layer = 0
; scarf_angle_threshold = 155
; seam_gap = 15%
; seam_placement_away_from_overhangs = 0
; seam_position = aligned
; seam_slope_conditional = 1
; seam_slope_entire_loop = 0
; seam_slope_gap = 0
; seam_slope_inner_walls = 1
; seam_slope_min_length = 10
; seam_slope_start_height = 10%
; seam_slope_steps = 10
; seam_slope_type = none
; silent_mode = 0
; single_extruder_multi_material = 1
; skeleton_infill_density = 15%
; skeleton_infill_line_width = 0.45
; skin_infill_density = 15%
; skin_infill_depth = 2
; skin_infill_line_width = 0.45
; skirt_distance = 2
; skirt_height = 1
; skirt_loops = 0
; skirt_per_object = 1
; slice_closing_radius = 0.049
; slicing_mode = regular
; slow_down_for_layer_cooling = 1
; slow_down_layer_time = 6
; slow_down_min_speed = 20
; slowdown_end_acc = 1000
; slowdown_end_height = 225
; slowdown_end_speed = 500
; slowdown_start_acc = 8000
; slowdown_start_height = 0
; slowdown_start_speed = 500
; small_perimeter_speed = 50%
; small_perimeter_threshold = 0
; smooth_coefficient = 4
; smooth_speed_discontinuity_area = 1
; solid_infill_filament = 0
; sparse_infill_acceleration = 100%
; sparse_infill_anchor = 400%
; sparse_infill_anchor_max = 20
; sparse_infill_density = 15%
; sparse_infill_filament = 0
; sparse_infill_lattice_angle_1 = -45
; sparse_infill_lattice_angle_2 = 45
; sparse_infill_line_width = 0.45
; sparse_infill_pattern = grid
; sparse_infill_speed = 230
; spiral_mode = 0
; spiral_mode_max_xy_smoothing = 200%
; spiral_mode_smooth = 0
; standby_temperature_delta = -5
; start_end_points = 30x-3,54x245
; supertack_plate_temp = 45
; supertack_plate_temp_initial_layer = 45
; support_air_filtration = 0
; support_angle = 0
; support_base_pattern = default
; support_base_pattern_spacing = 2.5
; support_bottom_interface_spacing = 0.5
; support_bottom_z_distance = 0.2
; support_chamber_temp_control = 0
; support_cooling_filter = 0
; support_critical_regions_only = 0
; support_expansion = 0
; support_fast_purge_mode = 1
; support_filament = 0
; support_interface_bottom_layers = 2
; support_interface_filament = 0
; support_interface_loop_pattern = 0
; support_interface_not_for_body = 1
; support_interface_pattern = auto
; support_interface_spacing = 0.5
; support_interface_speed = 80
; support_interface_top_layers = 2
; support_ironing_direction = 0
; support_ironing_flow = 10%
; support_ironing_inset = 0
; support_ironing_pattern = zig-zag
; support_ironing_spacing = 0.15
; support_ironing_speed = 30
; support_line_width = 0.42
; support_object_first_layer_gap = 0.2
; support_object_skip_flush = 1
; support_object_xy_distance = 0.35
; support_on_build_plate_only = 0
; support_remove_small_overhang = 1
; support_speed = 150
; support_style = default
; support_threshold_angle = 35
; support_top_z_distance = 0.2
; support_type = tree(auto)
; symmetric_infill_y_axis = 0
; temperature_vitrification = 45
; template_custom_gcode = 
; textured_plate_temp = 55
; textured_plate_temp_initial_layer = 55
; thick_bridges = 0
; thumbnail_size = 50x50
; time_lapse_gcode = ;======== A2L timelapse gcode ==========\n;===== 2026/05/09 ====\n{if !spiral_mode && print_sequence != \"by object\"}\n; SKIPPABLE_START\n; SKIPTYPE: timelapse\nM622.1 S1 ; for prev firware, default turned on\nM1002 judge_flag timelapse_record_flag\nM622 J1\n  G1 Z{max_layer_z + 0.4} F1200\n  G150.3 ; move to garbage can\n  G1 Y{first_layer_center_no_wipe_tower[1]} F30000; move to safe pos\n  M400\n  M1004 S5 P1  ; external shutter\n  M971 S11 C11 O0\n  M400 P350\nM623\n; SKIPPABLE_END\n{endif}\n; SKIPPABLE_START\n; SKIPTYPE: g39_detection\n; go x0 clamping detection, clear_to_x0 = [clear_to_x0]\n{if !spiral_mode && (print_sequence != \"by object\" || clear_to_x0)}\nM1002 judge_flag g39_detection_flag\nM622 J1\n  ; enable nozzle clog detect at 3rd layer\n  {if layer_num == 1 || layer_num == 2}\n    M400\n    G390.7 M7 S1 Z2.5\n  {endif}\n  {if layer_num > 5 && layer_z <= 10 && layer_z > 0.4 && layer_num % 6 == 0}\n    M400\n    G390.7 M7 S1 Z2.5\n  {endif}\n  M1002 judge_flag g39_mass_exceed_flag\n  M622 J1\n    {if layer_num > 2}\n      M400\n      G390.7 M9 S1 Z2.5\n    {endif}\n  M623\nM623\n{endif}\n; SKIPPABLE_END
; timelapse_type = 0
; top_area_threshold = 200%
; top_color_penetration_layers = 4
; top_one_wall_type = all top
; top_shell_layers = 4
; top_shell_thickness = 1
; top_solid_infill_flow_ratio = 1
; top_surface_acceleration = 2000
; top_surface_density = 100%
; top_surface_jerk = 9
; top_surface_line_width = 0.45
; top_surface_pattern = monotonicline
; top_surface_speed = 200
; top_z_overrides_xy_distance = 0
; travel_acceleration = 8000
; travel_jerk = 9
; travel_short_distance_acceleration = 250
; travel_speed = 500
; travel_speed_z = 0
; tree_support_branch_angle = 45
; tree_support_branch_diameter = 2
; tree_support_branch_diameter_angle = 5
; tree_support_branch_distance = 5
; tree_support_wall_count = -1
; upward_compatible_machine = "Bambu Lab H2S 0.4 nozzle"
; use_firmware_retraction = 0
; use_relative_e_distances = 1
; vertical_shell_speed = 80%
; volumetric_speed_coefficients = "0 0 0 0 0 0"
; wall_distribution_count = 1
; wall_filament = 0
; wall_generator = classic
; wall_loops = 2
; wall_sequence = inner wall/outer wall
; wall_transition_angle = 10
; wall_transition_filter_deviation = 25%
; wall_transition_length = 100%
; wipe = 1
; wipe_distance = 2
; wipe_speed = 80%
; wipe_tower_no_sparse_layers = 0
; wipe_tower_rotation_angle = 0
; wipe_tower_x = 15
; wipe_tower_y = 160
; wrapping_detection_gcode = 
; wrapping_detection_layers = 20
; wrapping_exclude_area = 
; xy_contour_compensation = 0
; xy_hole_compensation = 0
; z_direction_outwall_speed_continuous = 0
; z_hop = 0.4
; z_hop_types = Auto Lift
; CONFIG_BLOCK_END

; EXECUTABLE_BLOCK_START
M73 P0 R1533
M201 X12000 Y8000 Z1500 E5000
M203 X500 Y500 Z30 E30
M204 P12000 R5000 T12000
M205 X9.00 Y9.00 Z3.00 E3.00
M106 S0
; FEATURE: Custom
;M1002 set_flag extrude_cali_flag=1
;M1002 set_flag g29_before_print_flag=1
;M1002 set_flag build_plate_detect_flag=1
;M1002 set_flag bed_heat_stable_wait_flag=1

;======== A2L start gcode==========
;===== 2026/05/26 =====
T1000 O0
M1002 gcode_claim_action : 2

    M140 S{BED} ; heat heatbed first


M993 A0 B0 C0 ; nozzle cam detection not allowed.
M400

;=====printer start sound ===================
M17
M400 S1
M1006 S1
M1006 A53 B9 L30 C53 D9 M30 E53 F9 N30
M1006 A56 B9 L30 C56 D9 M30 E56 F9 N30
M1006 A61 B9 L30 C61 D9 M30 E61 F9 N30
M1006 A53 B9 L30 C53 D9 M30 E53 F9 N30
M1006 A56 B9 L30 C56 D9 M30 E56 F9 N30
M1006 A61 B18 L30 C61 D18 M30 E61 F18 N30
M1006 W
;=====printer start sound ===================

  M620 M ;enable remap
  G389

;===== avoid end stop =================
  G91
  G380 S2 Z22 F1200
  G380 S2 Z-12 F1200
  G90
;===== avoid end stop =================

;===== reset machine status =================
  M204 S10000
  M630 S0 P1
  G90
  M17 D ; reset motor current to default
  M960 S5 P1 ; turn on logo lamp
  M220 S100 ;Reset Feedrate
  M221 S100 ;Reset Flowrate
  M73.2   R1.0 ;Reset left time magnitude
  G29.1 Z0 ; clear z-trim value first
  M983.1 M1
  M982.2 S1 ; turn on cog noise reduction
  M983.4 S0
;===== reset machine status =================
;Set the filament gear warning temperature

    
        M142 P1 O60; set PLA/PLACF/PLAAERO/PVA/TPU gear warning temperature when start
    

;===== start to heat heatbed & hotend==========
  M1002 set_filament_type:PLA
  M104 S140 A

  G29.2 S0 ; avoid invalid abl data

;===== first homing start =====
  M1002 gcode_claim_action : 13
  M105
  G28 X Z P0 T300 W
  G150.3
  G1 Z1.3 F1200
  G150.1 F16000 ; wipe mouth to avoid filament stick to heatbed
  G90
  M400
;===== first homing end =====


;===== detection start =====
;===== build_plate_detect_flag start =====
M1002 judge_flag build_plate_detect_flag
M622 S1
  G91
  G1 Z5 F1200
  G90
  G0 X15 F30000
  G0 Y319 F3000
  G91
  G1 Z-5 F1200
  G28 Z P0 T140
  G1 F1200
  G39.4
  G90
  G1 Z5 F1200
M623
;===== build_plate_detect_flag end =====
;===== detection end =====


;===== hotend hotbed pre-heat start =====
  M104 S140 A ; rise nozzle temp in advance

  G90
  G1 Y220 F3000 ; Put away the heated bed to prevent collisions

  
      M190 S{BED}
  
;===== hotend hotbed pre-heat end =====


;===== prepare print temperature and material ==========
  M400
  M211 X0 Y0 Z0 ;turn off soft endstop
  M975 S1 ; turn on input shaping

  G29.2 S0 ; avoid invalid abl data
  G150.3

M620.10 A0 F573.733 H0.4 T240 P220 S1
M620.10 A1 F573.733 H0.4 T240 P220 S1


 M620.11 P0 L0 I0 E0
 M620.11 K0 I0 R0

  M620 S0A   ; switch material if AMS exist
  M1002 gcode_claim_action : 4
  M1002 set_filament_type:UNKNOWN
  M400
  T0
  M400
  M628 S0
  M629
  M400
  M1002 set_filament_type:PLA
  M621 S0A
  M104 S{TEMP}
  M400
  M106 P1 S0
  M400
  G29.2 S1

  G390.7 M6 G6 C3

;===== prepare print temperature and material ==========


;===== auto extrude cali start =========================
M975 S1
M1002 judge_flag extrude_cali_flag
  M622 J0
    M983.3 F9.58333 A0.4 ; cali dynamic extrusion compensation
  M623

  M622 J1
    M1002 set_filament_type:PLA
    M1002 gcode_claim_action : 8
    M109 S{TEMP}
    G90
    M83
    M983.3 F9.58333 A0.4 ; cali dynamic extrusion compensation
    M400
  M623

  M622 J2
    M1002 set_filament_type:PLA
    M1002 gcode_claim_action : 8
    M109 S{TEMP}
    G90
    M83
    M983.3 F9.58333 A0.4 ; cali dynamic extrusion compensation
    M400
  M623
;===== auto extrude cali end =========================


  
    M83
    G1 E-3 F1800
    M400 P500
  
  G0 Z1.3 F1200
  G150.2
  G150.1 F16000

  G91
  G1 X20 F12000 ; move away from the trash bin
  G90
  M400


;===== wipe nozzle start =====
  M1002 gcode_claim_action : 14
  G150 T220
  M400
  M109 S140 A
  M106 P1 S255
  G91
  G1 Z1.3 F1200
  G90
  M400 S1
  ;======== enhance brush nozzle start =====
  G150.1 F16000
  G91
  G1 Y5   F5000
  G1 X-20 F16000
  G1 Y-10 F5000
  G1 X-20 F16000
  G1 Y10  F5000
  G1 X20  F16000
  G1 Y-10 F5000
  G1 X20  F16000
  G1 Y5   F5000
  G90
  G150.1 F16000
  G150.3
  ;======== enhance brush nozzle end =====
  M106 P1 S0
;===== wipe nozzle end =====

;===== mech mode sweep start =====
  M1002 gcode_claim_action : 3
  G90
  G1 Z5 F1200
  G1 X165 Y160 F20000
  M400 P200
  M970.3 Q1 A5 K0 O3
  M970.3 Q1 B1
  M970.2 Q1 K1 W52 Z0.1 B30 ;
  M970.3 Q0 A10 K0 O1
  M970.3 Q0 B1
  M970.2 Q0 K1 W40 Z0.1 B20 ;
  M974 Q0 S2 P0
  M974 Q1 S2 P0
  M975 S1 R1 M1
  M400
  G1 X155 F3000
  G150.3
;===== mech mode sweep end =====


;===== bed leveling ==================================

  
    M190 S{BED} ; ensure bed temp
  
  M109 S140 A


  
    M1002 judge_flag bed_heat_stable_wait_flag
    M622 J1
      
        M1002 gcode_claim_action : 54
        G29.30 X14.3467 Y9.45299 I301.307 J301.094
      
    M623
  
  SYNC R0 T120 ; Adjust estimated time

  M106 S0 ; turn off fan , too noisy
  M1002 judge_flag g29_before_print_flag
  M622 J1
    M1002 gcode_claim_action : 1
    
      
        G29 A1 X14.3467 Y9.45299 I301.307 J301.094 O1 R
      
    
    M400
  M623

  M622 J2
    M1002 gcode_claim_action : 1
    
      
        G29 A2 X14.3467 Y9.45299 I301.307 J301.094 O1 R
      
    
    M400
  M623

  M622 J0
    G28 R
  M623
  G29.2 S1
;===== bed leveling end ================================

  M985.1 U0 E2
  M985.1 U1 E2

  M104 S{TEMP} A
  G150.3 ; move to garbage can to wait for temp

;===== wait temperature reaching the reference value =======
  
    M190 S{BED} ; ensure bed temp
  

  ;========turn off light and fans =============
  M960 S1 P0 ; turn off laser
  M960 S2 P0 ; turn off laser
  M106 S0 ; turn off cooling fan

;===== wait temperature reaching the reference value =======

  M1002 gcode_claim_action : 255
  M400
  M975 S1 ; turn on mech mode supression

;===== for Textured PEI Plate , lower the nozzle as the nozzle was touching topmost of the texture when homing ==
  
    
      G29.1 Z-0.04 ; for Textured PEI Plate
    
  

;===== nozzle load line ===============================
M1002 gcode_claim_action : 51
  G29.2 S1 ; ensure z comp turn on
  G90
  M83
  M400 P50
  M500 D1
  M400 S3
  M109 S{TEMP}
  G0 X145 Y0 F24000
  M400
  G130 O0 X145 Y-0.2 Z0.8 F4.78111 L40 E20 D4
  G90
  M83
  G1 Z0.2
  M400
;===== nozzle load line end ===========================
M1007 S1 C1;turn on mass estimation && clear
M1002 gcode_claim_action : 0
  G29.99


M1015.3 S0;disable tpu clog detect



M1015.4 S1 K1 H0.4 ;enable E air printing detect


M620.6 I0 W1 ;enable ams air printing detect

M1010 Q0 B0.005 S0.01
M1010 Q1 B0.002 S0.01
M1010.1 S1
; MACHINE_START_GCODE_END
;VT0 H-1
G90
G21
M83 ; use relative distances for extrusion
M981 S1 P20000 ;open spaghetti detector
