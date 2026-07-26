package com.solar.micro.model;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "amc_equipment")
@Getter @Setter @NoArgsConstructor
public class AmcEquipment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "amc_id", nullable = false)
    @JsonBackReference
    private AmcContract amcContract;

    @Column(name = "equipment_type", length = 100)
    private String equipmentType;

    @Column(name = "equipment_name", length = 150)
    private String equipmentName;

    @Column(length = 200)
    private String specification;

    @Column
    private Integer quantity;

}
